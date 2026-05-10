import type { OrchestratorTask, OrchestratorTaskPlan } from './stagedToolPipeline';

export interface SymphonyWorkflowStrategyPhase {
  id: 'durable-task' | 'isolated-worktree' | 'agentbus-review' | 'approval-gate';
  label: string;
  detail: string;
}

export interface SymphonyWorkflowStrategy {
  id: 'symphony-workflow-strategy';
  workspaceName: string;
  executionMode: OrchestratorTaskPlan['mode'];
  taskCount: number;
  taskStore: {
    kind: 'browser-durable-task-store';
    uri: 'indexeddb://agent-harness-tasks';
  };
  phases: SymphonyWorkflowStrategyPhase[];
  verificationCriteria: string[];
  teacherInstructions: string[];
  judgeRubricCriteria: string[];
}

export function createSymphonyWorkflowStrategy(
  plan: OrchestratorTaskPlan,
  workspaceName = 'Workspace',
): SymphonyWorkflowStrategy {
  return {
    id: 'symphony-workflow-strategy',
    workspaceName,
    executionMode: plan.mode,
    taskCount: plan.tasks.length,
    taskStore: {
      kind: 'browser-durable-task-store',
      uri: 'indexeddb://agent-harness-tasks',
    },
    phases: [
      {
        id: 'durable-task',
        label: 'Durable task intent',
        detail: 'Persist task intent and state before active execution so the workflow can resume.',
      },
      {
        id: 'isolated-worktree',
        label: 'Isolated worktree',
        detail: 'Assign each agent task to an isolated worktree branch before execution.',
      },
      {
        id: 'agentbus-review',
        label: 'AgentBus review',
        detail: 'Run voter phases and decider phases before executor work is committed.',
      },
      {
        id: 'approval-gate',
        label: 'Human Review handoff',
        detail: 'Stop at the review gate; merge requires approval from the user or reviewer agent.',
      },
    ],
    verificationCriteria: [
      'Symphony completion contract must preserve durable task intent before execution.',
      'Agent work must stay scoped to its isolated worktree branch.',
      'AgentBus must record voter phases, judge decider phases, executor result, and recovery state.',
      'Merge work must stop at the Human Review handoff until approved by the user or reviewer agent.',
    ],
    teacherInstructions: [
      'Check that the candidate keeps Symphony task intent durable before execution.',
      'Reject candidates that merge or mutate the common branch before a review gate approval.',
      'Require explicit AgentBus voter and judge-decider evidence before execution.',
    ],
    judgeRubricCriteria: [
      'symphony durable task intent persisted',
      'isolated worktree branch respected',
      'review gate approval required before merge',
      'AgentBus voter and decider phases recorded',
    ],
  };
}

export function appendSymphonyWorkflowContext(
  task: OrchestratorTask,
  strategy: SymphonyWorkflowStrategy,
): OrchestratorTask {
  const branchName = `agent/${slugify(strategy.workspaceName)}/${task.id}`;
  const context = [
    '',
    'Symphony completion contract:',
    `- Durable task store: ${strategy.taskStore.uri}.`,
    `- Isolated worktree branch: ${branchName}.`,
    '- Record task claim, voter phases, judge decider phases, executor result, and recovery state in AgentBus.',
    '- Stop at the Human Review handoff; merge only after user or reviewer-agent approval.',
  ].join('\n');
  return {
    ...task,
    prompt: `${task.prompt}${context}`,
    verificationCriteria: [
      ...task.verificationCriteria,
      ...strategy.verificationCriteria,
    ],
  };
}

export function formatSymphonyWorkflowStage(strategy: SymphonyWorkflowStrategy): string {
  return [
    'Symphony workflow strategy:',
    `State store: ${strategy.taskStore.uri}.`,
    `Execution mode: ${strategy.executionMode}.`,
    `Task count: ${strategy.taskCount}.`,
    ...strategy.phases.map((phase) => `${phase.label}: ${phase.detail}`),
  ].join('\n');
}

function slugify(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'workspace';
}
