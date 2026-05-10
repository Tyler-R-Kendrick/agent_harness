import type { HarnessPlugin, InferenceMessagesPayload, MemoryMessage, WorkspaceFile } from 'harness-core';

export interface SymphonyPluginOptions {
  point?: string;
  activeWorkflowPath?: string;
  priority?: number;
  role?: string;
}

export interface BuildWorkflowMdPromptContextOptions {
  activeWorkflowPath?: string | null;
}

export function detectWorkflowMdFile(path: string): boolean {
  return path === 'WORKFLOW.md' || path.endsWith('/WORKFLOW.md');
}

export function validateWorkflowMdFile(file: WorkspaceFile): string | null {
  return detectWorkflowMdFile(file.path) ? null : 'Unsupported WORKFLOW.md path.';
}

export function discoverWorkflowMdFiles(files: readonly WorkspaceFile[]): WorkspaceFile[] {
  return files.filter((file) => detectWorkflowMdFile(file.path));
}

export function buildWorkflowMdPromptContext(
  files: readonly WorkspaceFile[],
  options: BuildWorkflowMdPromptContextOptions = {},
): string {
  const workflows = discoverWorkflowMdFiles(files);
  const activeWorkflow = options.activeWorkflowPath
    ? workflows.find((file) => file.path === options.activeWorkflowPath) ?? null
    : null;
  const otherWorkflows = activeWorkflow
    ? workflows.filter((file) => file.path !== activeWorkflow.path)
    : workflows;

  if (activeWorkflow) {
    return [
      `Active WORKFLOW.md:\n- ${activeWorkflow.path}\n${activeWorkflow.content}`,
      otherWorkflows.length
        ? `Other WORKFLOW.md files:\n${otherWorkflows.map(formatWorkflowFile).join('\n')}`
        : null,
    ].filter((section): section is string => Boolean(section)).join('\n\n');
  }

  return otherWorkflows.length
    ? `WORKFLOW.md files:\n${otherWorkflows.map(formatWorkflowFile).join('\n')}`
    : 'WORKFLOW.md files: none';
}

export function createSymphonyPlugin<TMessage extends MemoryMessage = MemoryMessage>(
  files: readonly WorkspaceFile[],
  options: SymphonyPluginOptions = {},
): HarnessPlugin<TMessage, InferenceMessagesPayload<TMessage>> {
  return {
    id: 'symphony',
    register({ hooks }) {
      hooks.registerPipe({
        id: 'symphony.workflow-md',
        point: options.point ?? 'before-llm-messages',
        kind: 'deterministic',
        priority: options.priority ?? -8_500,
        run: ({ payload }) => {
          const workflows = discoverWorkflowMdFiles(files);
          if (!workflows.length) {
            return { output: { applied: false, reason: 'no-workflow-md-file' } };
          }

          return {
            payload: {
              ...payload,
              messages: [
                {
                  role: options.role ?? 'system',
                  content: buildWorkflowMdPromptContext(workflows, { activeWorkflowPath: options.activeWorkflowPath }),
                } as unknown as TMessage,
                ...payload.messages,
              ],
            },
            output: {
              applied: true,
              workflowPaths: workflows.map((file) => file.path),
            },
          };
        },
      });
    },
  };
}

export * from './board.js';
export {
  INTERNAL_TASK_STORE_CONFIG,
  createHarnessTaskManager,
  isHarnessManagedTask,
} from '@agent-harness/task-manager';
export type {
  HarnessManagedTask,
  HarnessTaskManager,
  HarnessTaskSummary,
} from '@agent-harness/task-manager';
export {
  WorkGraphCommandError,
  applyAgentIssueProposal,
  createAgentIssueProposal,
  createInMemoryWorkGraphRepository,
  createSequentialWorkGraphIdFactory,
  createWorkGraph,
  createWorkGraphExternalStore,
  enqueueWorkGraphAutomationTask,
  exportWorkGraph,
  importWorkGraph,
  searchWorkGraph,
  selectIssuesForView,
  sortIssuesByPriority,
} from '@agent-harness/workgraph';
export type {
  WorkGraph,
  WorkGraphActor,
  WorkGraphCommand,
  WorkGraphEvent,
  WorkGraphExternalStore,
  WorkGraphIssue,
  WorkGraphProjectionState,
} from '@agent-harness/workgraph';

function formatWorkflowFile(file: WorkspaceFile): string {
  return `- ${file.path}\n${file.content}`;
}
