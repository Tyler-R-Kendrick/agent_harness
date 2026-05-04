import { createActor, fromPromise, setup } from 'xstate';
import {
  MockGitRepository,
  PayloadType,
  type IAgentBus,
  type MockPullRequest,
  type MockPullRequestReview,
} from 'logact';
import { createAgentBus } from './agentBus.js';

export interface GitWorkItem {
  id: string;
  title: string;
  intent: string;
  dependencies: string[];
  parallel: boolean;
  branchName: string;
  planPullRequestId?: string;
}

export type GitWorkCommitContent =
  | {
      phase: 'intent';
      taskId: string;
      title: string;
      intent: string;
      dependencies: string[];
      parallel: boolean;
    }
  | { phase: 'vote'; taskId: string; voterId: string; vote: MockPullRequestReview['vote']; reason?: string }
  | { phase: 'decision'; taskId: string; decision: 'approved' | 'requires-feedback' | 'rejected'; reason?: string }
  | { phase: 'action'; taskId: string; action: string; status: 'running' }
  | { phase: 'result'; taskId: string; status: 'success'; output: string }
  | { phase: 'result'; taskId: string; status: 'error'; error: string; output?: string }
  | { phase: 'rubber-duck'; taskId: string; analysis: string }
  | { phase: 'recovery-intent'; taskId: string; title: string; intent: string; error: string };

export type GitWorkExecutionResult =
  | { status: 'success'; output: string }
  | { status: 'error'; error: string; output?: string };

export interface GitWorkExecutor {
  execute(item: GitWorkItem): Promise<GitWorkExecutionResult>;
}

export interface GitWorkVoter {
  readonly id: string;
  vote(context: {
    workItem: GitWorkItem;
    pullRequest: MockPullRequest;
    git: MockGitRepository<GitWorkCommitContent>;
  }): Promise<MockPullRequestReview> | MockPullRequestReview;
}

export interface GitWorkRubberDuck {
  analyze(context: {
    workItem: GitWorkItem;
    error: string;
    git: MockGitRepository<GitWorkCommitContent>;
  }): Promise<string> | string;
}

export interface GitWorkSagaOptions {
  request: string;
  git?: MockGitRepository<GitWorkCommitContent>;
  bus?: IAgentBus;
  voters?: GitWorkVoter[];
  executor: GitWorkExecutor;
  rubberDuck?: GitWorkRubberDuck;
}

export interface GitWorkExecutionSummary {
  taskId: string;
  status: 'success' | 'error';
  output?: string;
  error?: string;
  executionPullRequestId: string;
  recoveryPullRequestId?: string;
}

export interface GitWorkSagaResult {
  workItems: GitWorkItem[];
  planPullRequestIds: string[];
  planMerged: boolean;
  executions: GitWorkExecutionSummary[];
}

interface SagaRuntime {
  request: string;
  git: MockGitRepository<GitWorkCommitContent>;
  bus: IAgentBus;
  voters: GitWorkVoter[];
  executor: GitWorkExecutor;
  rubberDuck?: GitWorkRubberDuck;
  result: GitWorkSagaResult;
}

export async function runGitWorkSaga(options: GitWorkSagaOptions): Promise<GitWorkSagaResult> {
  const runtime: SagaRuntime = {
    request: options.request,
    git: options.git ?? new MockGitRepository<GitWorkCommitContent>(),
    bus: options.bus ?? createAgentBus(),
    voters: options.voters ?? [createTrajectoryCriticVoter()],
    executor: options.executor,
    ...(options.rubberDuck !== undefined ? { rubberDuck: options.rubberDuck } : {}),
    result: {
      workItems: [],
      planPullRequestIds: [],
      planMerged: false,
      executions: [],
    },
  };

  await runSagaMachine(runtime);
  return runtime.result;
}

export function createTrajectoryCriticVoter(): GitWorkVoter {
  return {
    id: 'trajectory-critic',
    vote({ pullRequest, git }) {
      const commits = git.getCommits().filter((commit) => pullRequest.commitIds.includes(commit.id));
      const hasIntent = commits.some((commit) => commit.content.phase === 'intent');
      const hasError = commits.some((commit) => commit.content.phase === 'result' && commit.content.status === 'error');
      if (!hasIntent) {
        return {
          voterId: 'trajectory-critic',
          vote: 'request-changes',
          reason: 'draft PR needs an intent commit before review',
        };
      }
      if (hasError) {
        return {
          voterId: 'trajectory-critic',
          vote: 'request-changes',
          reason: 'execution history contains an error result',
        };
      }
      return {
        voterId: 'trajectory-critic',
        vote: 'approve',
        reason: 'intent is recorded as a discrete PR work item',
      };
    },
  };
}

async function runSagaMachine(runtime: SagaRuntime): Promise<void> {
  const machine = setup({
    actors: {
      planIntentPullRequests: fromPromise(async () => planIntentPullRequests(runtime)),
      voteAndMergePlan: fromPromise(async () => voteAndMergePlan(runtime)),
      executePlan: fromPromise(async () => executePlan(runtime)),
    },
  }).createMachine({
    initial: 'planning',
    states: {
      planning: {
        invoke: {
          src: 'planIntentPullRequests',
          onDone: { target: 'reviewing' },
        },
      },
      reviewing: {
        invoke: {
          src: 'voteAndMergePlan',
          onDone: { target: 'executing' },
        },
      },
      executing: {
        invoke: {
          src: 'executePlan',
          onDone: { target: 'done' },
        },
      },
      done: { type: 'final' },
    },
  });

  await new Promise<void>((resolve) => {
    const actor = createActor(machine);
    const subscription = actor.subscribe((snapshot) => {
      if (snapshot.status === 'done') {
        subscription.unsubscribe();
        resolve();
      }
    });
    actor.start();
  });
}

async function planIntentPullRequests(runtime: SagaRuntime): Promise<void> {
  const workItems = splitWorkRequest(runtime.request);
  runtime.result.workItems = workItems;

  for (const workItem of workItems) {
    runtime.git.createBranch(workItem.branchName, 'main');
    runtime.git.checkout(workItem.branchName);
    const pullRequest = runtime.git.openDraftPullRequest({
      branchName: workItem.branchName,
      targetBranchName: 'main',
      title: `Plan ${workItem.id}: ${workItem.title}`,
      authorId: 'planner',
    });
    workItem.planPullRequestId = pullRequest.id;
    runtime.result.planPullRequestIds.push(pullRequest.id);
    runtime.git.commit({
      content: {
        phase: 'intent',
        taskId: workItem.id,
        title: workItem.title,
        intent: workItem.intent,
        dependencies: workItem.dependencies,
        parallel: workItem.parallel,
      },
      message: `intent(${workItem.id}): ${workItem.title}`,
      authorId: 'planner',
      status: 'planned',
    });
    await runtime.bus.append({
      type: PayloadType.Intent,
      intentId: workItem.id,
      action: workItem.intent,
      meta: { actorId: 'planner', actorRole: 'planner', branchId: workItem.branchName },
    });
  }
}

async function voteAndMergePlan(runtime: SagaRuntime): Promise<void> {
  for (const workItem of runtime.result.workItems) {
    const pullRequest = runtime.git.getPullRequest(workItem.planPullRequestId!);
    const reviews = await Promise.all(runtime.voters.map((voter) => voter.vote({
      workItem,
      pullRequest,
      git: runtime.git,
    })));
    for (const review of reviews) {
      runtime.git.voteOnPullRequest(pullRequest.id, review);
      runtime.git.checkout(workItem.branchName);
      runtime.git.commit({
        content: {
          phase: 'vote',
          taskId: workItem.id,
          voterId: review.voterId,
          vote: review.vote,
          ...(review.reason !== undefined ? { reason: review.reason } : {}),
        },
        message: `vote(${workItem.id}): ${review.voterId} ${review.vote}`,
        authorId: review.voterId,
        status: review.vote === 'approve' ? 'success' : 'feedback',
      });
      await runtime.bus.append({
        type: PayloadType.Vote,
        intentId: workItem.id,
        voterId: review.voterId,
        approve: review.vote === 'approve',
        reason: review.reason,
        meta: { actorId: review.voterId, actorRole: 'voter', branchId: workItem.branchName },
      });
    }

    const decision = decideReviews(reviews);
    runtime.git.checkout(workItem.branchName);
    runtime.git.commit({
      content: {
        phase: 'decision',
        taskId: workItem.id,
        decision,
        reason: decision === 'approved' ? 'all voters approved' : 'one or more voters requested changes',
      },
      message: `decision(${workItem.id}): ${decision}`,
      authorId: 'decider',
      status: decision === 'approved' ? 'success' : 'feedback',
    });
    runtime.git.decidePullRequest(pullRequest.id, {
      deciderId: 'decider',
      decision,
      reason: decision === 'approved' ? 'all voters approved' : 'one or more voters requested changes',
    });
    if (decision === 'approved') {
      runtime.git.markPullRequestReady(pullRequest.id);
      runtime.git.mergePullRequest(pullRequest.id, {
        authorId: 'decider',
        message: `merge ${workItem.id} plan`,
      });
      await runtime.bus.append({
        type: PayloadType.Commit,
        intentId: workItem.id,
        meta: { actorId: 'decider', actorRole: 'decider', branchId: 'main' },
      });
    } else {
      await runtime.bus.append({
        type: PayloadType.Abort,
        intentId: workItem.id,
        reason: 'plan requires feedback',
        meta: { actorId: 'decider', actorRole: 'decider', branchId: workItem.branchName },
      });
    }
  }

  runtime.result.planMerged = runtime.result.workItems.every((workItem) => {
    const pullRequest = runtime.git.getPullRequest(workItem.planPullRequestId!);
    return pullRequest.state === 'merged';
  });
}

async function executePlan(runtime: SagaRuntime): Promise<void> {
  if (!runtime.result.planMerged) {
    return;
  }
  for (const workItem of runtime.result.workItems) {
    const execution = await executeWorkItem(runtime, workItem);
    runtime.result.executions.push(execution);
  }
}

async function executeWorkItem(
  runtime: SagaRuntime,
  workItem: GitWorkItem,
): Promise<GitWorkExecutionSummary> {
  const executionBranchName = `exec/${slugTask(workItem)}`;
  runtime.git.createBranch(executionBranchName, 'main');
  runtime.git.checkout(executionBranchName);
  const pullRequest = runtime.git.openDraftPullRequest({
    branchName: executionBranchName,
    targetBranchName: 'main',
    title: `Execute ${workItem.id}: ${workItem.title}`,
    authorId: 'executor',
  });
  runtime.git.commit({
    content: { phase: 'action', taskId: workItem.id, action: workItem.intent, status: 'running' },
    message: `action(${workItem.id}): execute ${workItem.title}`,
    authorId: 'executor',
    status: 'running',
  });
  await runtime.bus.append({
    type: PayloadType.Policy,
    target: 'harness.git.action',
    value: { taskId: workItem.id, action: workItem.intent },
    meta: { actorId: 'executor', actorRole: 'executor', branchId: executionBranchName },
  });

  const executionResult = await runtime.executor.execute(workItem);
  runtime.git.checkout(executionBranchName);
  if (executionResult.status === 'success') {
    runtime.git.commit({
      content: { phase: 'result', taskId: workItem.id, status: 'success', output: executionResult.output },
      message: `result(${workItem.id}): success`,
      authorId: 'executor',
      status: 'success',
    });
    runtime.git.markPullRequestReady(pullRequest.id);
    runtime.git.decidePullRequest(pullRequest.id, {
      deciderId: 'decider',
      decision: 'approved',
      reason: 'execution completed successfully',
    });
    runtime.git.mergePullRequest(pullRequest.id, {
      authorId: 'decider',
      message: `merge ${workItem.id} execution`,
    });
    await runtime.bus.append({
      type: PayloadType.Result,
      intentId: workItem.id,
      output: executionResult.output,
      meta: { actorId: 'executor', actorRole: 'executor', branchId: executionBranchName },
    });
    return {
      taskId: workItem.id,
      status: 'success',
      output: executionResult.output,
      executionPullRequestId: pullRequest.id,
    };
  }

  runtime.git.commit({
    content: {
      phase: 'result',
      taskId: workItem.id,
      status: 'error',
      error: executionResult.error,
      ...(executionResult.output !== undefined ? { output: executionResult.output } : {}),
    },
    message: `result(${workItem.id}): error`,
    authorId: 'executor',
    status: 'error',
  });
  await runtime.bus.append({
    type: PayloadType.Result,
    intentId: workItem.id,
    output: executionResult.output ?? '',
    error: executionResult.error,
    meta: { actorId: 'executor', actorRole: 'executor', branchId: executionBranchName },
  });
  const recoveryPullRequestId = await openRecoveryPlanningPullRequest(runtime, workItem, executionResult.error);
  return {
    taskId: workItem.id,
    status: 'error',
    error: executionResult.error,
    ...(executionResult.output !== undefined ? { output: executionResult.output } : {}),
    executionPullRequestId: pullRequest.id,
    recoveryPullRequestId,
  };
}

async function openRecoveryPlanningPullRequest(
  runtime: SagaRuntime,
  workItem: GitWorkItem,
  error: string,
): Promise<string> {
  const recoveryBranchName = `recovery/${slugTask(workItem)}`;
  runtime.git.createBranch(recoveryBranchName, 'main');
  runtime.git.checkout(recoveryBranchName);
  const recoveryPullRequest = runtime.git.openDraftPullRequest({
    branchName: recoveryBranchName,
    targetBranchName: 'main',
    title: `Recovery ${workItem.id}: ${workItem.title}`,
    authorId: 'planner',
  });
  const analysis = runtime.rubberDuck
    ? await runtime.rubberDuck.analyze({ workItem, error, git: runtime.git })
    : `Review the failed execution from an independent perspective: ${error}`;
  runtime.git.commit({
    content: { phase: 'rubber-duck', taskId: workItem.id, analysis },
    message: `rubber-duck(${workItem.id}): analyze execution error`,
    authorId: 'rubber-duck',
    status: 'feedback',
  });
  runtime.git.voteOnPullRequest(recoveryPullRequest.id, {
    voterId: 'rubber-duck',
    vote: 'comment',
    reason: analysis,
  });
  runtime.git.commit({
    content: {
      phase: 'recovery-intent',
      taskId: `${workItem.id}-recovery`,
      title: `Recover ${workItem.title}`,
      intent: `Address ${error}`,
      error,
    },
    message: `intent(${workItem.id}-recovery): recover ${workItem.title}`,
    authorId: 'planner',
    status: 'planned',
  });
  runtime.git.decidePullRequest(recoveryPullRequest.id, {
    deciderId: 'decider',
    decision: 'requires-feedback',
    reason: 'execution error needs a recovery planning pass',
  });
  await runtime.bus.append({
    type: PayloadType.Policy,
    target: 'harness.git.rubber-duck',
    value: { taskId: workItem.id, error, analysis },
    meta: { actorId: 'rubber-duck', actorRole: 'voter', branchId: recoveryBranchName },
  });
  return recoveryPullRequest.id;
}

function decideReviews(reviews: MockPullRequestReview[]): 'approved' | 'requires-feedback' | 'rejected' {
  if (reviews.some((review) => review.vote === 'reject')) {
    return 'rejected';
  }
  if (reviews.some((review) => review.vote === 'request-changes')) {
    return 'requires-feedback';
  }
  return 'approved';
}

function splitWorkRequest(request: string): GitWorkItem[] {
  return request
    .split(/\r?\n|(?<=\.)\s+/)
    .map((part) => part.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').replace(/[.]\s*$/, '').trim())
    .filter((part) => part.length > 0)
    .map((title, index) => {
      const id = `task-${index + 1}`;
      const item = {
        id,
        title,
        intent: title,
        dependencies: [],
        parallel: true,
        branchName: '',
      };
      return { ...item, branchName: `work/${slugTask(item)}` };
    });
}

function slugTask(task: Pick<GitWorkItem, 'id' | 'title'>): string {
  const slug = task.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return `${task.id}-${slug || 'work'}`;
}
