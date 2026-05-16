import type { DurableTaskRecord } from '@agent-harness/browser-durable-tasks';
import {
  INTERNAL_TASK_STORE_CONFIG,
  type HarnessManagedTask,
  type HarnessTaskActivity,
  type HarnessTaskManager,
  type HarnessTaskManagerOptions,
  type HarnessTaskMetadata,
  type HarnessTaskReview,
  type HarnessTaskSnapshot,
  type HarnessTaskSummary,
} from './types.js';

export function createHarnessTaskManager(options: HarnessTaskManagerOptions): HarnessTaskManager {
  let autopilotEnabled = options.autopilotEnabled ?? true;
  const now = () => options.now?.() ?? Date.now();
  options.runtime.defineTask({
    type: INTERNAL_TASK_STORE_CONFIG.taskType,
    maxAttempts: 1,
    run: async ({ input }) => input,
  });

  const manager: HarnessTaskManager = {
    async createTask(input) {
      const createdAt = now();
      const identifier = await nextIdentifier();
      const metadata: HarnessTaskMetadata = {
        kind: 'harness-task',
        source: 'internal',
        workspaceId: options.workspaceId,
        identifier,
        title: input.title,
        description: input.description,
        lane: 'ready',
        priority: input.priority ?? 'normal',
        labels: input.labels ?? [],
        assignee: null,
        review: emptyReview(),
        merge: null,
        activity: [activity(`${identifier}-created`, 'Task created', 'Added to internal task store.', createdAt)],
        createdAt,
        updatedAt: createdAt,
      };
      const durable = await options.runtime.enqueue(INTERNAL_TASK_STORE_CONFIG.taskType, {
        title: input.title,
        description: input.description,
      }, {
        metadata,
        idempotencyKey: `${options.workspaceId}:${identifier}`,
      });
      return toHarnessTask(durable);
    },
    async dispatchToAgent(id, input) {
      return updateHarnessTask(options, id, (metadata) => ({
        lane: 'running',
        assignee: input,
        activity: appendActivity(
          metadata,
          'Agent dispatched',
          `${input.agentId} owns ${input.worktreeBranch}.`,
          now(),
        ),
      }), 'running');
    },
    async requestReview(id, input) {
      return updateHarnessTask(options, id, (metadata) => ({
        lane: 'review',
        review: {
          ...metadata.review,
          status: 'requested',
          requesterAgentId: input.requesterAgentId,
          summary: input.summary,
          changedFiles: input.changedFiles,
          feedback: [],
          approvedBy: null,
          rejectedBy: null,
          decidedAt: null,
        },
        activity: appendActivity(metadata, 'Review requested', input.summary, now()),
      }), 'waiting');
    },
    async approveMerge(id, input) {
      if (input.actor.type === 'reviewer-agent' && !autopilotEnabled) {
        throw new Error('Reviewer agent approvals require autopilot to be enabled');
      }
      return updateHarnessTask(options, id, (metadata) => ({
        lane: 'merge',
        review: {
          ...metadata.review,
          status: 'approved',
          approvedBy: input.actor,
          rejectedBy: null,
          feedback: [],
          summary: input.summary,
          decidedAt: now(),
        },
        activity: appendActivity(metadata, 'Merge approved', `${input.actor.id}: ${input.summary}`, now()),
      }), 'waiting');
    },
    async rejectMerge(id, input) {
      if (input.actor.type === 'reviewer-agent' && input.feedback.length === 0) {
        throw new Error('Reviewer agent rejections require actionable feedback');
      }
      return updateHarnessTask(options, id, (metadata) => ({
        lane: 'rework',
        review: {
          ...metadata.review,
          status: 'rejected',
          rejectedBy: input.actor,
          approvedBy: null,
          feedback: input.feedback,
          decidedAt: now(),
        },
        activity: appendActivity(metadata, 'Review rejected', input.feedback.join(' '), now()),
      }), 'waiting');
    },
    async completeTask(id, input) {
      return updateHarnessTask(options, id, (metadata) => ({
        lane: 'done',
        merge: {
          mergedBy: input.mergedBy,
          completedAt: now(),
        },
        activity: appendActivity(metadata, 'Task completed', `${input.mergedBy} merged the isolated branch.`, now()),
      }), 'completed');
    },
    async listTasks() {
      const durableTasks = await options.runtime.listTasks({ type: INTERNAL_TASK_STORE_CONFIG.taskType });
      return durableTasks
        .filter((task) => isHarnessDurableTask(task, options.workspaceId))
        .map(toHarnessTask);
    },
    async snapshot(): Promise<HarnessTaskSnapshot> {
      return {
        tasks: await manager.listTasks(),
        summary: await manager.summarize(),
        store: INTERNAL_TASK_STORE_CONFIG,
      };
    },
    async summarize(): Promise<HarnessTaskSummary> {
      const tasks = await manager.listTasks();
      const nextApproval = tasks.find((task) => task.lane === 'review') ?? null;
      return {
        active: tasks.filter((task) => task.lane === 'running').length,
        waitingForReview: tasks.filter((task) => task.lane === 'review').length,
        mergeReady: tasks.filter((task) => task.lane === 'merge').length,
        blocked: tasks.filter((task) => task.lane === 'rework').length,
        nextApprovalTaskId: nextApproval?.id ?? null,
        autopilotEnabled,
      };
    },
    getSettings() {
      return { autopilotEnabled };
    },
    setAutopilotEnabled(enabled) {
      autopilotEnabled = enabled;
    },
  };

  async function nextIdentifier(): Promise<string> {
    const tasks = await manager.listTasks();
    const max = tasks.reduce((largest, task) => {
      const parsed = Number.parseInt(task.identifier.replace(/^HT-/, ''), 10);
      return Number.isFinite(parsed) ? Math.max(largest, parsed) : largest;
    }, 0);
    return `HT-${max + 1}`;
  }

  return manager;
}

export function isHarnessManagedTask(value: unknown): value is HarnessManagedTask {
  if (!value || typeof value !== 'object') return false;
  const task = value as Partial<HarnessManagedTask>;
  return task.kind === 'harness-task'
    && task.source === 'internal'
    && typeof task.id === 'string'
    && typeof task.title === 'string'
    && typeof task.stateUri === 'string';
}

async function updateHarnessTask(
  options: HarnessTaskManagerOptions,
  id: string,
  patcher: (metadata: HarnessTaskMetadata) => Partial<HarnessTaskMetadata>,
  status: DurableTaskRecord['status'],
): Promise<HarnessManagedTask> {
  const updatedAt = options.now?.() ?? Date.now();
  const updated = await options.runtime.updateTask(id, (task) => {
    const metadata = workspaceMetadataFrom(task, options.workspaceId);
    return {
      status,
      metadata: {
        ...metadata,
        ...patcher(metadata),
        updatedAt,
      },
    };
  });
  return toHarnessTask(updated);
}

function toHarnessTask(record: DurableTaskRecord): HarnessManagedTask {
  const metadata = record.metadata as HarnessTaskMetadata;
  return {
    ...metadata,
    id: record.id,
    durableTaskId: record.id,
    status: record.status,
    stateUri: `${INTERNAL_TASK_STORE_CONFIG.uri}/tasks/${record.id}`,
  };
}

function workspaceMetadataFrom(record: DurableTaskRecord, workspaceId: string): HarnessTaskMetadata {
  if (!isHarnessDurableTask(record, workspaceId)) {
    throw new Error(`Durable task ${record.id} is not a harness task for workspace ${workspaceId}`);
  }
  return record.metadata as HarnessTaskMetadata;
}

function isHarnessDurableTask(record: DurableTaskRecord, workspaceId?: string): boolean {
  return record.metadata.kind === 'harness-task'
    && record.metadata.source === 'internal'
    && typeof record.metadata.identifier === 'string'
    && (workspaceId === undefined || record.metadata.workspaceId === workspaceId);
}

function emptyReview(): HarnessTaskReview {
  return {
    status: 'none',
    requesterAgentId: null,
    summary: null,
    changedFiles: [],
    feedback: [],
    approvedBy: null,
    rejectedBy: null,
    decidedAt: null,
  };
}

function appendActivity(metadata: HarnessTaskMetadata, label: string, detail: string, at: number): HarnessTaskActivity[] {
  return [...metadata.activity, activity(`${metadata.identifier}-${metadata.activity.length + 1}`, label, detail, at)];
}

function activity(id: string, label: string, detail: string, at: number): HarnessTaskActivity {
  return { id, label, detail, at };
}
