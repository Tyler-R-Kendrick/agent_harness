import { jsonSchema, tool, type ToolSet } from 'ai';
import {
  getModelContextRegistry,
  invokeModelContextTool,
  ModelContext,
  ModelContextClient,
  type RegisteredToolDefinition,
} from '@agent-harness/webmcp';

import type { WebMcpToolDescriptor, WebMcpToolGroup } from './types';

const WEBMCP_TOOL_ID_PREFIX = 'webmcp:';
const DEFAULT_INPUT_SCHEMA = { type: 'object', properties: {} };
const WEBMCP_BUILTIN_GROUP: { group: WebMcpToolGroup; groupLabel: string } = {
  group: 'built-in',
  groupLabel: 'Built-In',
};

// Maps each registered tool name to its display sub-group within the Built-In bucket.
// The subGroup key matches the old top-level group ids so DEFAULT_COLLAPSED_TOOL_GROUPS
// and TOOL_GROUP_ORDER in the host app continue to control ordering and collapse state.
const WEBMCP_SUBGROUP_BY_TOOL: Readonly<Record<string, { subGroup: WebMcpToolGroup; subGroupLabel: string }>> = {
  // Browser pages
  list_browser_pages: { subGroup: 'browser-worktree-mcp', subGroupLabel: 'Browser' },
  read_browser_page: { subGroup: 'browser-worktree-mcp', subGroupLabel: 'Browser' },
  read_browser_page_history: { subGroup: 'browser-worktree-mcp', subGroupLabel: 'Browser' },
  create_browser_page: { subGroup: 'browser-worktree-mcp', subGroupLabel: 'Browser' },
  navigate_browser_page: { subGroup: 'browser-worktree-mcp', subGroupLabel: 'Browser' },
  navigate_browser_page_history: { subGroup: 'browser-worktree-mcp', subGroupLabel: 'Browser' },
  refresh_browser_page: { subGroup: 'browser-worktree-mcp', subGroupLabel: 'Browser' },
  // Sessions
  list_sessions: { subGroup: 'sessions-worktree-mcp', subGroupLabel: 'Sessions' },
  create_session: { subGroup: 'sessions-worktree-mcp', subGroupLabel: 'Sessions' },
  read_session: { subGroup: 'sessions-worktree-mcp', subGroupLabel: 'Sessions' },
  list_session_tools: { subGroup: 'sessions-worktree-mcp', subGroupLabel: 'Sessions' },
  submit_session_message: { subGroup: 'sessions-worktree-mcp', subGroupLabel: 'Sessions' },
  change_session_model: { subGroup: 'sessions-worktree-mcp', subGroupLabel: 'Sessions' },
  switch_session_mode: { subGroup: 'sessions-worktree-mcp', subGroupLabel: 'Sessions' },
  change_session_tools: { subGroup: 'sessions-worktree-mcp', subGroupLabel: 'Sessions' },
  // Files (workspace surface + session filesystem + drives)
  list_filesystem_entries: { subGroup: 'files-worktree-mcp', subGroupLabel: 'Files' },
  read_filesystem_properties: { subGroup: 'files-worktree-mcp', subGroupLabel: 'Files' },
  read_filesystem_history: { subGroup: 'files-worktree-mcp', subGroupLabel: 'Files' },
  rollback_filesystem_history: { subGroup: 'files-worktree-mcp', subGroupLabel: 'Files' },
  change_filesystem_mount: { subGroup: 'files-worktree-mcp', subGroupLabel: 'Files' },
  add_filesystem_entry: { subGroup: 'files-worktree-mcp', subGroupLabel: 'Files' },
  update_filesystem_entry: { subGroup: 'files-worktree-mcp', subGroupLabel: 'Files' },
  remove_filesystem_entry: { subGroup: 'files-worktree-mcp', subGroupLabel: 'Files' },
  list_session_filesystem: { subGroup: 'files-worktree-mcp', subGroupLabel: 'Files' },
  read_session_folder: { subGroup: 'files-worktree-mcp', subGroupLabel: 'Files' },
  read_session_file: { subGroup: 'files-worktree-mcp', subGroupLabel: 'Files' },
  create_session_file: { subGroup: 'files-worktree-mcp', subGroupLabel: 'Files' },
  create_session_folder: { subGroup: 'files-worktree-mcp', subGroupLabel: 'Files' },
  write_session_file: { subGroup: 'files-worktree-mcp', subGroupLabel: 'Files' },
  delete_session_filesystem_entry: { subGroup: 'files-worktree-mcp', subGroupLabel: 'Files' },
  rename_session_filesystem_entry: { subGroup: 'files-worktree-mcp', subGroupLabel: 'Files' },
  scaffold_session_filesystem_entry: { subGroup: 'files-worktree-mcp', subGroupLabel: 'Files' },
  list_session_drives: { subGroup: 'files-worktree-mcp', subGroupLabel: 'Files' },
  mount_session_drive: { subGroup: 'files-worktree-mcp', subGroupLabel: 'Files' },
  unmount_session_drive: { subGroup: 'files-worktree-mcp', subGroupLabel: 'Files' },
  // Clipboard
  list_clipboard_history: { subGroup: 'clipboard-worktree-mcp', subGroupLabel: 'Clipboard' },
  read_clipboard_entry: { subGroup: 'clipboard-worktree-mcp', subGroupLabel: 'Clipboard' },
  restore_clipboard_entry: { subGroup: 'clipboard-worktree-mcp', subGroupLabel: 'Clipboard' },
  // Artifacts
  list_artifacts: { subGroup: 'artifacts-mcp', subGroupLabel: 'Artifacts' },
  read_artifact: { subGroup: 'artifacts-mcp', subGroupLabel: 'Artifacts' },
  create_artifact: { subGroup: 'artifacts-mcp', subGroupLabel: 'Artifacts' },
  update_artifact: { subGroup: 'artifacts-mcp', subGroupLabel: 'Artifacts' },
  // User context
  recall_user_context: { subGroup: 'user-context-mcp', subGroupLabel: 'User Context' },
  read_browser_location: { subGroup: 'user-context-mcp', subGroupLabel: 'User Context' },
  elicit_user_input: { subGroup: 'user-context-mcp', subGroupLabel: 'User Context' },
  request_secret: { subGroup: 'secrets-mcp', subGroupLabel: 'Secrets' },
  // Search
  search_web: { subGroup: 'web-search-mcp', subGroupLabel: 'Search' },
  read_web_page: { subGroup: 'web-search-mcp', subGroupLabel: 'Search' },
  // Renderer viewport panes
  list_render_panes: { subGroup: 'renderer-viewport-mcp', subGroupLabel: 'Renderer' },
  close_render_pane: { subGroup: 'renderer-viewport-mcp', subGroupLabel: 'Renderer' },
  move_render_pane: { subGroup: 'renderer-viewport-mcp', subGroupLabel: 'Renderer' },
  // Harness UI
  list_harness_elements: { subGroup: 'harness-ui-mcp', subGroupLabel: 'Harness UI' },
  read_harness_element: { subGroup: 'harness-ui-mcp', subGroupLabel: 'Harness UI' },
  read_harness_prompt_context: { subGroup: 'harness-ui-mcp', subGroupLabel: 'Harness UI' },
  patch_harness_element: { subGroup: 'harness-ui-mcp', subGroupLabel: 'Harness UI' },
  regenerate_harness_ui: { subGroup: 'harness-ui-mcp', subGroupLabel: 'Harness UI' },
  restore_harness_ui: { subGroup: 'harness-ui-mcp', subGroupLabel: 'Harness UI' },
  // Workspace context (worktree, files surface, prompt tools)
  workspace_overview: { subGroup: 'worktree-mcp', subGroupLabel: 'Workspace' },
  workspace_file: { subGroup: 'worktree-mcp', subGroupLabel: 'Workspace' },
  list_worktree_items: { subGroup: 'worktree-mcp', subGroupLabel: 'Workspace' },
  read_worktree_render_pane_state: { subGroup: 'worktree-mcp', subGroupLabel: 'Workspace' },
  toggle_worktree_render_pane: { subGroup: 'worktree-mcp', subGroupLabel: 'Workspace' },
  list_worktree_context_actions: { subGroup: 'worktree-mcp', subGroupLabel: 'Workspace' },
  invoke_worktree_context_action: { subGroup: 'worktree-mcp', subGroupLabel: 'Workspace' },
  read_worktree_context_menu_state: { subGroup: 'worktree-mcp', subGroupLabel: 'Workspace' },
  toggle_worktree_context_menu: { subGroup: 'worktree-mcp', subGroupLabel: 'Workspace' },
};

export interface WebMcpToolBridgeOptions {
  createClient?: () => ModelContextClient;
}

export interface WebMcpToolBridge {
  createToolSet(): ToolSet;
  getDescriptors(): WebMcpToolDescriptor[];
  subscribe(listener: () => void): () => void;
}

type ToolRegistryLike = {
  list(): RegisteredToolDefinition[];
  subscribe(listener: () => void): () => void;
};

export function toWebMcpToolId(name: string): string {
  return `${WEBMCP_TOOL_ID_PREFIX}${name}`;
}

function toDescriptor(definition: RegisteredToolDefinition): WebMcpToolDescriptor {
  const subGroupInfo = WEBMCP_SUBGROUP_BY_TOOL[definition.name];
  return {
    id: toWebMcpToolId(definition.name),
    label: definition.title?.trim() || definition.name,
    description: definition.description,
    group: WEBMCP_BUILTIN_GROUP.group,
    groupLabel: WEBMCP_BUILTIN_GROUP.groupLabel,
    ...(subGroupInfo ? { subGroup: subGroupInfo.subGroup, subGroupLabel: subGroupInfo.subGroupLabel } : {}),
  };
}

function toInputSchema(definition: RegisteredToolDefinition): Record<string, unknown> {
  const schema = definition.rawInputSchema;
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return DEFAULT_INPUT_SCHEMA;
  }

  return schema as Record<string, unknown>;
}

function toInvocationInput(input: unknown): object {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('WebMCP tool input must be an object.');
  }

  return input;
}

function toRegistry(modelContext: ModelContext): ToolRegistryLike | null {
  const registry = getModelContextRegistry(modelContext) as ToolRegistryLike | undefined;
  if (!registry || typeof registry.list !== 'function' || typeof registry.subscribe !== 'function') {
    return null;
  }

  return registry;
}

function toTool(
  modelContext: ModelContext,
  definition: RegisteredToolDefinition,
  createClient: () => ModelContextClient,
) {
  return tool({
    description: definition.description,
    inputSchema: jsonSchema(toInputSchema(definition)),
    execute: async (input) => invokeModelContextTool(modelContext, definition.name, toInvocationInput(input), createClient()),
  });
}

export function createWebMcpToolBridge(
  modelContext: ModelContext,
  options: WebMcpToolBridgeOptions = {},
): WebMcpToolBridge {
  const registry = toRegistry(modelContext);
  const createClient = options.createClient ?? (() => new ModelContextClient());

  return {
    createToolSet() {
      if (!registry) {
        return {} as ToolSet;
      }

      return Object.fromEntries(
        registry.list().map((definition) => [toWebMcpToolId(definition.name), toTool(modelContext, definition, createClient)]),
      ) as ToolSet;
    },
    getDescriptors() {
      if (!registry) {
        return [];
      }

      return registry.list().map(toDescriptor).sort((left, right) => left.label.localeCompare(right.label));
    },
    subscribe(listener) {
      if (!registry) {
        return () => undefined;
      }

      return registry.subscribe(() => listener());
    },
  };
}
