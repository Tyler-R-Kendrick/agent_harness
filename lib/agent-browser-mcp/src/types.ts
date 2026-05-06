export type WebMcpToolGroup =
  | 'built-in'
  | 'worktree-mcp'
  | 'renderer-viewport-mcp'
  | 'harness-ui-mcp'
  | 'browser-worktree-mcp'
  | 'sessions-worktree-mcp'
  | 'files-worktree-mcp'
  | 'clipboard-worktree-mcp'
  | 'artifacts-mcp'
  | 'user-context-mcp'
  | 'settings-mcp'
  | 'secrets-mcp'
  | 'web-search-mcp';

export interface WebMcpToolDescriptor {
  id: string;
  label: string;
  description: string;
  group: WebMcpToolGroup;
  groupLabel: string;
  subGroup?: string;
  subGroupLabel?: string;
}
