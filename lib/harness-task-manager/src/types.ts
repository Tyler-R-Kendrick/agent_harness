import type { DurableTaskRuntime, DurableTaskStatus } from '@agent-harness/browser-durable-tasks';

export type HarnessTaskLane = 'ready' | 'running' | 'review' | 'rework' | 'merge' | 'done' | 'cancelled';
export type HarnessTaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type HarnessReviewStatus = 'none' | 'requested' | 'approved' | 'rejected';
export type HarnessActorType = 'user' | 'agent' | 'reviewer-agent';

export interface HarnessActor {
  type: HarnessActorType;
  id: string;
}

export interface HarnessTaskAssignee {
  agentId: string;
  role: string;
  worktreeBranch: string;
  worktreePath: string;
}

export interface HarnessTaskReview {
  status: HarnessReviewStatus;
  requesterAgentId: string | null;
  summary: string | null;
  changedFiles: string[];
  feedback: string[];
  approvedBy: HarnessActor | null;
  rejectedBy: HarnessActor | null;
  decidedAt: number | null;
}

export interface HarnessTaskMerge {
  mergedBy: string;
  completedAt: number;
}

export interface HarnessTaskActivity {
  id: string;
  label: string;
  detail: string;
  at: number;
}

export interface HarnessTaskMetadata extends Record<string, unknown> {
  kind: 'harness-task';
  source: 'internal';
  workspaceId: string;
  identifier: string;
  title: string;
  description: string;
  lane: HarnessTaskLane;
  priority: HarnessTaskPriority;
  labels: string[];
  assignee: HarnessTaskAssignee | null;
  review: HarnessTaskReview;
  merge: HarnessTaskMerge | null;
  activity: HarnessTaskActivity[];
  createdAt: number;
  updatedAt: number;
}

export interface HarnessManagedTask extends HarnessTaskMetadata {
  id: string;
  durableTaskId: string;
  status: DurableTaskStatus;
  stateUri: string;
}

export interface CreateHarnessTaskInput {
  title: string;
  description: string;
  priority?: HarnessTaskPriority;
  labels?: string[];
}

export interface DispatchHarnessTaskInput extends HarnessTaskAssignee {}

export interface RequestHarnessReviewInput {
  requesterAgentId: string;
  summary: string;
  changedFiles: string[];
}

export interface ReviewDecisionInput {
  actor: HarnessActor;
  summary: string;
}

export interface RejectReviewInput {
  actor: HarnessActor;
  feedback: string[];
}

export interface CompleteHarnessTaskInput {
  mergedBy: string;
}

export interface HarnessTaskManagerSettings {
  autopilotEnabled: boolean;
}

export interface HarnessTaskSummary {
  active: number;
  waitingForReview: number;
  mergeReady: number;
  blocked: number;
  nextApprovalTaskId: string | null;
  autopilotEnabled: boolean;
}

export interface HarnessTaskSnapshot {
  tasks: HarnessManagedTask[];
  summary: HarnessTaskSummary;
  store: typeof INTERNAL_TASK_STORE_CONFIG;
}

export interface HarnessTaskManagerOptions {
  runtime: DurableTaskRuntime;
  workspaceId: string;
  now?: () => number;
  autopilotEnabled?: boolean;
}

export interface HarnessTaskManager {
  createTask(input: CreateHarnessTaskInput): Promise<HarnessManagedTask>;
  dispatchToAgent(id: string, input: DispatchHarnessTaskInput): Promise<HarnessManagedTask>;
  requestReview(id: string, input: RequestHarnessReviewInput): Promise<HarnessManagedTask>;
  approveMerge(id: string, input: ReviewDecisionInput): Promise<HarnessManagedTask>;
  rejectMerge(id: string, input: RejectReviewInput): Promise<HarnessManagedTask>;
  completeTask(id: string, input: CompleteHarnessTaskInput): Promise<HarnessManagedTask>;
  listTasks(): Promise<HarnessManagedTask[]>;
  snapshot(): Promise<HarnessTaskSnapshot>;
  summarize(): Promise<HarnessTaskSummary>;
  getSettings(): HarnessTaskManagerSettings;
  setAutopilotEnabled(enabled: boolean): void;
}

export const INTERNAL_TASK_STORE_CONFIG = {
  kind: 'browser-durable-task-store',
  uri: 'indexeddb://agent-harness-tasks',
  taskType: 'harness.task',
  workerChannel: 'agent-harness-task-worker',
  serviceWorkerOutbox: 'agent-harness-network-outbox',
} as const;
