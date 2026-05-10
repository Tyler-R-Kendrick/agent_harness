import type { DurableTaskRuntime } from '@agent-harness/browser-durable-tasks';
import type { WorkGraphAutomationInput } from './automation-types.js';

export function workGraphAutomationTaskType(kind: WorkGraphAutomationInput['kind']): string {
  return `workgraph.${kind}`;
}

export async function enqueueWorkGraphAutomationTask(runtime: DurableTaskRuntime, input: WorkGraphAutomationInput) {
  return runtime.enqueue(workGraphAutomationTaskType(input.kind), input, {
    idempotencyKey: `workgraph:${input.kind}:${input.workspaceId}:${input.issueId}`,
    metadata: { workspaceId: input.workspaceId, issueId: input.issueId },
  });
}
