// ─── Domain types ────────────────────────────────────────────────────────────

export type MemoryTier = 'hot' | 'warm' | 'cool' | 'cold';
export type NodeType = 'root' | 'workspace' | 'folder' | 'tab';
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'thinking' | 'streaming' | 'complete' | 'error';
export type ProviderStatus = 'connected' | 'not_configured';
export type ModelStatus = 'available' | 'installed' | 'loading';
export type PanelId =
  | 'workspaces'
  | 'chat'
  | 'history'
  | 'extensions'
  | 'settings'
  | 'account';

// ─── Tree ────────────────────────────────────────────────────────────────────

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

// ─── Chat ────────────────────────────────────────────────────────────────────

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

// ─── Providers ───────────────────────────────────────────────────────────────

export interface LLMModel {
  id: string;
  name: string;
  enabled: boolean;
}

export interface ModelProvider {
  id: string;
  name: string;
  color: string;
  status: ProviderStatus;
  apiKey: string;
  models: LLMModel[];
}

export interface ApiEndpoint {
  url: string;
  header: string;
  prefix: string;
}

// ─── Local / HF models ───────────────────────────────────────────────────────

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

// ─── MCP ─────────────────────────────────────────────────────────────────────

export interface McpAppDef {
  name: string;
  icon: string;
  description: string;
  parameters: Record<string, unknown>;
}

export type McpRegistry = Record<string, McpAppDef>;

// ─── History / Extensions ────────────────────────────────────────────────────

export interface HistorySession {
  id: number;
  title: string;
  date: string;
  preview: string;
  events: string[];
}

export interface Extension {
  id: number;
  name: string;
  author: string;
  category: string;
  rating: number;
  users: string;
  enabled: boolean;
  color: string;
  description: string;
}

// ─── TJS Worker messages ─────────────────────────────────────────────────────

export interface TjsGenerateOptions {
  task: string;
  modelId: string;
  prompt: unknown;
  options?: Record<string, unknown>;
}

export interface TjsCallbacks {
  onStatus?: (msg: string) => void;
  onPhase?: (phase: string) => void;
  onToken?: (token: string) => void;
  onDone?: (result: unknown) => void;
  onError?: (err: Error) => void;
}
