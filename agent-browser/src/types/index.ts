export type MemoryTier = 'hot' | 'warm' | 'cool' | 'cold';
export type NodeType = 'root' | 'workspace' | 'folder' | 'tab';
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'thinking' | 'streaming' | 'complete' | 'error';
export type ModelStatus = 'available' | 'installed' | 'loading';
export type PanelId = 'workspaces' | 'history' | 'extensions' | 'settings' | 'account';

export interface TreeNode {
  id: string;
  name: string;
  type: NodeType;
  children?: TreeNode[];
  expanded?: boolean;
  persisted?: boolean;
  activeMemory?: boolean;
  memoryTier?: MemoryTier;
  memoryMB?: number;
  url?: string;
  color?: string;
}

export interface McpCard {
  app: string;
  args: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  streamedContent?: string;
  status?: MessageStatus;
  isLocal?: boolean;
  thinkingContent?: string;
  thinkingDuration?: number;
  isThinking?: boolean;
  cards?: McpCard[];
  loadingStatus?: string | null;
  statusText?: string | null;
  isError?: boolean;
}

export interface HFModel {
  id: string;
  name: string;
  author: string;
  task: string;
  downloads: number;
  likes: number;
  tags: string[];
  sizeMB: number | null;
  status: ModelStatus;
}

export interface McpAppDef {
  name: string;
  icon: string;
  description: string;
  parameters: Record<string, unknown>;
}

export type McpRegistry = Record<string, McpAppDef>;

export interface HistorySession {
  id: number;
  title: string;
  date: string;
  preview: string;
  events: string[];
}

export type IntegrationKind = 'agents' | 'skills' | 'plugins' | 'hooks' | 'mcps';

export type WorkspaceFileKind = 'agents' | 'skill' | 'plugin' | 'hook';

export interface IntegrationSurface {
  id: string;
  name: string;
  kind: IntegrationKind;
  source: string;
  enabled: boolean;
  color: string;
  description: string;
  badges: string[];
  constraint?: string;
}

export interface WorkspaceFile {
  path: string;
  content: string;
  updatedAt: string;
}

export interface WorkspaceSkill {
  path: string;
  directory: string;
  name: string;
  description: string;
  content: string;
}

export interface WorkspacePlugin {
  path: string;
  directory: string;
  manifestName: string;
  content: string;
}

export interface WorkspaceHook {
  path: string;
  name: string;
  content: string;
}

export interface WorkspaceCapabilities {
  agents: WorkspaceFile[];
  skills: WorkspaceSkill[];
  plugins: WorkspacePlugin[];
  hooks: WorkspaceHook[];
}

export interface BrowserInferenceRequest {
  task: string;
  modelId: string;
  prompt: unknown;
  options?: Record<string, unknown>;
}

export interface BrowserInferenceCallbacks {
  onStatus?: (msg: string) => void;
  onPhase?: (phase: string) => void;
  onToken?: (token: string) => void;
  onDone?: (result: unknown) => void;
  onError?: (err: Error) => void;
}
