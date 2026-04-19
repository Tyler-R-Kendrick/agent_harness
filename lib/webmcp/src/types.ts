export const MODEL_CONTEXT_TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;

export interface ToolAnnotations {
  readOnlyHint?: boolean;
}

export interface ModelContextRegistrationOptions {
  signal?: AbortSignal;
}

export interface ModelContextRegisterToolOptions {
  signal?: AbortSignal;
}

export interface ModelContextRegisterResourceOptions extends ModelContextRegistrationOptions {}

export interface ModelContextRegisterPromptOptions extends ModelContextRegistrationOptions {}

export interface ModelContextRegisterPromptTemplateOptions extends ModelContextRegistrationOptions {}

export type UserInteractionCallback<TResult = unknown> = () => TResult | Promise<TResult>;

export interface ModelContextClientLike {
  requestUserInteraction<TResult = unknown>(callback: UserInteractionCallback<TResult>): Promise<TResult>;
}

export type ToolExecuteCallback<TResult = unknown> = (
  input: object,
  client: ModelContextClientLike,
) => TResult | Promise<TResult>;

export type ResourceReadCallback<TResult = unknown> = (
  client: ModelContextClientLike,
) => TResult | Promise<TResult>;

export interface ModelContextPromptMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ModelContextPromptResult {
  description?: string;
  messages: ModelContextPromptMessage[];
}

export type PromptRenderCallback<TResult = ModelContextPromptResult> = (
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

export interface ModelContextResource {
  uri: string;
  title?: string | null;
  description: string;
  mimeType?: string | null;
  read: ResourceReadCallback;
}

export interface RegisteredResourceDefinition {
  uri: string;
  title?: string | null;
  description: string;
  mimeType?: string | null;
  read: ResourceReadCallback;
}

export interface ResourceRegistryChange {
  type: 'register' | 'unregister';
  resource: RegisteredResourceDefinition;
}

export type ResourceRegistryListener = (change: ResourceRegistryChange) => void;

export interface ModelContextPrompt {
  name: string;
  title?: string | null;
  description: string;
  inputSchema?: unknown;
  render: PromptRenderCallback;
}

export interface RegisteredPromptDefinition {
  name: string;
  title?: string | null;
  description: string;
  inputSchema: string;
  rawInputSchema?: unknown;
  render: PromptRenderCallback;
}

export interface PromptRegistryChange {
  type: 'register' | 'unregister';
  prompt: RegisteredPromptDefinition;
}

export type PromptRegistryListener = (change: PromptRegistryChange) => void;

export interface ModelContextPromptTemplate {
  name: string;
  title?: string | null;
  description: string;
  inputSchema?: unknown;
  render: PromptRenderCallback;
}

export interface RegisteredPromptTemplateDefinition {
  name: string;
  title?: string | null;
  description: string;
  inputSchema: string;
  rawInputSchema?: unknown;
  render: PromptRenderCallback;
}

export interface PromptTemplateRegistryChange {
  type: 'register' | 'unregister';
  promptTemplate: RegisteredPromptTemplateDefinition;
}

export type PromptTemplateRegistryListener = (change: PromptTemplateRegistryChange) => void;

export interface InvokeToolOptions {
  signal?: AbortSignal;
}

export interface ToolLifecycleDetail {
  input: object;
  toolName: string;
  client: ModelContextClientLike;
}