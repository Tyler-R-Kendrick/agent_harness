import type { AgentResult, ReasoningTrace, TaskInput } from '../schemas';

export interface ArtifactStore {
  saveTask(task: TaskInput): Promise<void>;
  saveTrace(trace: ReasoningTrace): Promise<void>;
  saveCheckerArtifact(taskId: string, artifact: Record<string, unknown>): Promise<void>;
  saveResult(result: AgentResult): Promise<void>;
  loadResult(taskId: string): Promise<AgentResult | null>;
}

export async function createArtifactStore(): Promise<ArtifactStore> {
  const tasks = new Map<string, TaskInput>();
  const traces = new Map<string, ReasoningTrace>();
  const artifacts = new Map<string, Record<string, unknown>[]>();
  const results = new Map<string, AgentResult>();

  return {
    async saveTask(task: TaskInput): Promise<void> {
      tasks.set(task.task_id, task);
    },
    async saveTrace(trace: ReasoningTrace): Promise<void> {
      traces.set(trace.task_id, trace);
    },
    async saveCheckerArtifact(taskId: string, artifact: Record<string, unknown>): Promise<void> {
      artifacts.set(taskId, [...(artifacts.get(taskId) ?? []), artifact]);
    },
    async saveResult(result: AgentResult): Promise<void> {
      results.set(result.task_id, result);
    },
    async loadResult(taskId: string): Promise<AgentResult | null> {
      return results.get(taskId) ?? null;
    },
  };
}
