export const MODEL_CONTEXT_TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;

export interface ToolAnnotations {
  readOnlyHint?: boolean;
}

export interface ModelContextRegisterToolOptions {
  signal?: AbortSignal;
}

export type UserInteractionCallback<TResult = unknown> = () => TResult | Promise<TResult>;

export interface ModelContextClientLike {
  requestUserInteraction<TResult = unknown>(callback: UserInteractionCallback<TResult>): Promise<TResult>;
}

export type ToolExecuteCallback<TResult = unknown> = (
  input: object,
  client: ModelContextClientLike,
) => TResult | Promise<TResult>;

export interface ModelContextTool {
  name: string;
  title?: string | null;
  description: string;
  inputSchema?: unknown;
  execute: ToolExecuteCallback;
  annotations?: ToolAnnotations;
}

export interface RegisteredToolDefinition {
  name: string;
  title?: string | null;
  description: string;
  inputSchema: string;
  rawInputSchema?: unknown;
  execute: ToolExecuteCallback;
  readOnlyHint: boolean;
}

export interface ToolRegistryChange {
  type: 'register' | 'unregister';
  tool: RegisteredToolDefinition;
}

export type ToolRegistryListener = (change: ToolRegistryChange) => void;

export interface InvokeToolOptions {
  signal?: AbortSignal;
}

export interface ToolLifecycleDetail {
  input: object;
  toolName: string;
  client: ModelContextClientLike;
}