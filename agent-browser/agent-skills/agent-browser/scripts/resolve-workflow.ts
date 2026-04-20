export type AgentBrowserWorkflowId =
  | 'inspect-workspace'
  | 'edit-default-skill'
  | 'inspect-runtime-output'
  | 'link-durable-file';

export interface AgentBrowserWorkflowStep {
  tool: string;
  purpose: string;
}

export interface AgentBrowserWorkflow {
  id: AgentBrowserWorkflowId;
  steps: AgentBrowserWorkflowStep[];
}

const WORKFLOWS: Record<AgentBrowserWorkflowId, AgentBrowserWorkflow> = {
  'inspect-workspace': {
    id: 'inspect-workspace',
    steps: [
      { tool: 'list_render_panes', purpose: 'Inspect current visible surfaces first.' },
      { tool: 'list_worktree_items', purpose: 'Inspect active workspace items before scanning broadly.' },
      { tool: 'list_filesystem_entries', purpose: 'List durable workspace files.' },
    ],
  },
  'edit-default-skill': {
    id: 'edit-default-skill',
    steps: [
      { tool: 'list_filesystem_entries', purpose: 'Find the bundled skill file under the workspace copy.' },
      { tool: 'read_filesystem_properties', purpose: 'Read the current durable file contents.' },
      { tool: 'update_filesystem_entry', purpose: 'Modify the workspace file in place.' },
    ],
  },
  'inspect-runtime-output': {
    id: 'inspect-runtime-output',
    steps: [
      { tool: 'list_sessions', purpose: 'Find the relevant chat or terminal session.' },
      { tool: 'read_session', purpose: 'Confirm the session context.' },
      { tool: 'change_filesystem_mount', purpose: 'Mount the session filesystem if needed.' },
      { tool: 'list_filesystem_entries', purpose: 'Inspect runtime output under the session filesystem.' },
    ],
  },
  'link-durable-file': {
    id: 'link-durable-file',
    steps: [
      { tool: 'change_filesystem_mount', purpose: 'Ensure the destination session filesystem is mounted.' },
      { tool: 'add_filesystem_entry', purpose: 'Create a symlink from the workspace file into runtime.' },
    ],
  },
};

export function resolveWorkflow(input: string): AgentBrowserWorkflow {
  const normalized = input.toLowerCase();

  if (normalized.includes('default skill') || normalized.includes('edit skill')) {
    return WORKFLOWS['edit-default-skill'];
  }

  if (normalized.includes('runtime') || normalized.includes('session output')) {
    return WORKFLOWS['inspect-runtime-output'];
  }

  if (normalized.includes('symlink') || normalized.includes('link durable')) {
    return WORKFLOWS['link-durable-file'];
  }

  return WORKFLOWS['inspect-workspace'];
}