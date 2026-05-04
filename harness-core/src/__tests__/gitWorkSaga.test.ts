import { describe, expect, it, vi } from 'vitest';
import { PayloadType } from 'logact';
import { MockGitRepository } from 'logact';
import {
  createAgentBus,
  createTrajectoryCriticVoter,
  readAgentBusEntries,
  runGitWorkSaga,
  type GitWorkCommitContent,
} from '../index.js';

describe('runGitWorkSaga', () => {
  it('splits requests into task branches with draft PR intent commits and merges approved plans', async () => {
    const git = new MockGitRepository<GitWorkCommitContent>({ now: clock(10_000) });
    const bus = createAgentBus();

    const result = await runGitWorkSaga({
      request: 'Update parser.\nAdd parser regression tests.',
      git,
      bus,
      voters: [createTrajectoryCriticVoter()],
      executor: {
        execute: vi.fn()
          .mockResolvedValueOnce({ status: 'success', output: 'parser updated' })
          .mockResolvedValueOnce({ status: 'success', output: 'tests added' }),
      },
    });

    expect(result.workItems.map((item) => item.title)).toEqual([
      'Update parser',
      'Add parser regression tests',
    ]);
    expect(git.getBranches().map((branch) => branch.name)).toEqual(expect.arrayContaining([
      'work/task-1-update-parser',
      'work/task-2-add-parser-regression-tests',
      'exec/task-1-update-parser',
      'exec/task-2-add-parser-regression-tests',
    ]));
    expect(git.getPullRequests().filter((pr) => pr.title.startsWith('Plan '))).toEqual([
      expect.objectContaining({
        title: 'Plan task-1: Update parser',
        draft: false,
        state: 'merged',
        reviews: [expect.objectContaining({ voterId: 'trajectory-critic', vote: 'approve' })],
      }),
      expect.objectContaining({
        title: 'Plan task-2: Add parser regression tests',
        draft: false,
        state: 'merged',
        reviews: [expect.objectContaining({ voterId: 'trajectory-critic', vote: 'approve' })],
      }),
    ]);
    expect(git.getCommits().map((commit) => commit.message)).toEqual(expect.arrayContaining([
      'intent(task-1): Update parser',
      'intent(task-2): Add parser regression tests',
      'action(task-1): execute Update parser',
      'result(task-1): success',
      'action(task-2): execute Add parser regression tests',
      'result(task-2): success',
    ]));
    expect(result.planMerged).toBe(true);
    expect(result.executions.map((execution) => execution.status)).toEqual(['success', 'success']);

    const busEntries = await readAgentBusEntries(bus);
    expect(busEntries.map((entry) => entry.payload.type)).toEqual(expect.arrayContaining([
      PayloadType.Intent,
      PayloadType.Vote,
      PayloadType.Commit,
      PayloadType.Result,
    ]));
  });

  it('branches failed execution into a rubber-duck recovery planning PR', async () => {
    const git = new MockGitRepository<GitWorkCommitContent>({ now: clock(20_000) });

    const result = await runGitWorkSaga({
      request: 'Wire payment webhook.',
      git,
      voters: [createTrajectoryCriticVoter()],
      executor: {
        execute: vi.fn().mockResolvedValue({
          status: 'error',
          error: 'webhook secret missing',
        }),
      },
      rubberDuck: {
        analyze: vi.fn().mockResolvedValue('Check secret initialization before retrying.'),
      },
    });

    expect(result.executions).toEqual([
      expect.objectContaining({
        taskId: 'task-1',
        status: 'error',
        error: 'webhook secret missing',
        recoveryPullRequestId: expect.any(String),
      }),
    ]);
    const recoveryPr = git.getPullRequest(result.executions[0].recoveryPullRequestId!);
    expect(recoveryPr).toEqual(expect.objectContaining({
      title: 'Recovery task-1: Wire payment webhook',
      draft: true,
      state: 'feedback-required',
      reviews: [expect.objectContaining({ voterId: 'rubber-duck', vote: 'comment' })],
    }));
    expect(git.getCommits().map((commit) => commit.message)).toEqual(expect.arrayContaining([
      'result(task-1): error',
      'rubber-duck(task-1): analyze execution error',
      'intent(task-1-recovery): recover Wire payment webhook',
    ]));
  });

  it('uses the built-in rubber duck recovery text and preserves partial error output', async () => {
    const git = new MockGitRepository<GitWorkCommitContent>({ now: clock(25_000) });

    const result = await runGitWorkSaga({
      request: '!!!',
      git,
      voters: [createTrajectoryCriticVoter()],
      executor: {
        execute: vi.fn().mockResolvedValue({
          status: 'error',
          error: 'tool crashed',
          output: 'partial trace',
        }),
      },
    });

    expect(result.workItems[0].branchName).toBe('work/task-1-work');
    expect(result.executions).toEqual([
      expect.objectContaining({
        status: 'error',
        error: 'tool crashed',
        output: 'partial trace',
      }),
    ]);
    expect(git.getCommits()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: 'rubber-duck(task-1): analyze execution error',
        content: expect.objectContaining({
          phase: 'rubber-duck',
          analysis: 'Review the failed execution from an independent perspective: tool crashed',
        }),
      }),
    ]));
  });

  it('keeps rejected or feedback-required plan PRs out of execution', async () => {
    const feedbackGit = new MockGitRepository<GitWorkCommitContent>({ now: clock(30_000) });
    const rejectedGit = new MockGitRepository<GitWorkCommitContent>({ now: clock(40_000) });
    const executor = { execute: vi.fn().mockResolvedValue({ status: 'success', output: 'unused' }) };

    const feedback = await runGitWorkSaga({
      request: 'Refine dashboard copy.',
      git: feedbackGit,
      voters: [{
        id: 'teacher',
        vote: () => ({ voterId: 'teacher', vote: 'request-changes' }),
      }],
      executor,
    });
    const rejected = await runGitWorkSaga({
      request: 'Delete audit logs.',
      git: rejectedGit,
      voters: [{
        id: 'security',
        vote: () => ({ voterId: 'security', vote: 'reject', reason: 'unsafe' }),
      }],
      executor,
    });

    expect(feedback.planMerged).toBe(false);
    expect(feedback.executions).toEqual([]);
    expect(feedbackGit.getPullRequests()[0]).toEqual(expect.objectContaining({
      state: 'feedback-required',
      draft: true,
    }));
    expect(rejected.planMerged).toBe(false);
    expect(rejected.executions).toEqual([]);
    expect(rejectedGit.getPullRequests()[0]).toEqual(expect.objectContaining({
      state: 'rejected',
      draft: true,
    }));
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('uses the default git repo, bus, and trajectory critic voter when omitted', async () => {
    const result = await runGitWorkSaga({
      request: 'Document default saga wiring.',
      executor: { execute: vi.fn().mockResolvedValue({ status: 'success', output: 'documented' }) },
    });

    expect(result.planMerged).toBe(true);
    expect(result.planPullRequestIds).toEqual(['pr-1']);
    expect(result.executions).toEqual([
      expect.objectContaining({ taskId: 'task-1', status: 'success', output: 'documented' }),
    ]);
  });

  it('uses trajectory critic PR votes to request changes for missing intents and error histories', async () => {
    const voter = createTrajectoryCriticVoter();
    const missingIntentGit = new MockGitRepository<GitWorkCommitContent>({ now: clock(50_000) });
    missingIntentGit.createBranch('work/missing-intent', 'main');
    const missingIntentPr = missingIntentGit.openDraftPullRequest({
      branchName: 'work/missing-intent',
      targetBranchName: 'main',
      title: 'Missing intent',
      authorId: 'planner',
    });

    const errorGit = new MockGitRepository<GitWorkCommitContent>({ now: clock(60_000) });
    errorGit.createBranch('work/error', 'main');
    errorGit.checkout('work/error');
    const errorPr = errorGit.openDraftPullRequest({
      branchName: 'work/error',
      targetBranchName: 'main',
      title: 'Error history',
      authorId: 'planner',
    });
    errorGit.commit({
      content: {
        phase: 'intent',
        taskId: 'task-error',
        title: 'Recover',
        intent: 'Recover',
        dependencies: [],
        parallel: true,
      },
      message: 'intent(task-error): Recover',
      authorId: 'planner',
    });
    errorGit.commit({
      content: { phase: 'result', taskId: 'task-error', status: 'error', error: 'failed' },
      message: 'result(task-error): error',
      authorId: 'executor',
      status: 'error',
    });

    await expect(Promise.resolve(voter.vote({
      workItem: {
        id: 'task-missing',
        title: 'Missing',
        intent: 'Missing',
        dependencies: [],
        parallel: true,
        branchName: 'work/missing-intent',
        planPullRequestId: missingIntentPr.id,
      },
      pullRequest: missingIntentPr,
      git: missingIntentGit,
    }))).resolves.toEqual(expect.objectContaining({
      vote: 'request-changes',
      reason: 'draft PR needs an intent commit before review',
    }));
    await expect(Promise.resolve(voter.vote({
      workItem: {
        id: 'task-error',
        title: 'Recover',
        intent: 'Recover',
        dependencies: [],
        parallel: true,
        branchName: 'work/error',
        planPullRequestId: errorPr.id,
      },
      pullRequest: errorGit.getPullRequest(errorPr.id),
      git: errorGit,
    }))).resolves.toEqual(expect.objectContaining({
      vote: 'request-changes',
      reason: 'execution history contains an error result',
    }));
  });
});

function clock(start: number): () => number {
  let now = start;
  return () => now++;
}
