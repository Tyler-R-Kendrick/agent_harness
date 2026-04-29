export type WebMcpToolGroup =
  | 'built-in'
  | 'worktree-mcp'
  | 'renderer-viewport-mcp'
  | 'browser-worktree-mcp'
  | 'sessions-worktree-mcp'
  | 'files-worktree-mcp'
  | 'clipboard-worktree-mcp'
  | 'user-context-mcp'
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
