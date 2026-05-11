export interface MemoryMessage {
  role?: string;
  content?: string;
}

export interface CoreMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CoreInferenceClient {
  infer(messages: CoreMessage[], options?: CoreInferenceOptions): Promise<string>;
}

export type JsonSchema = Record<string, unknown>;

export interface CoreInferenceOptions {
  constrainedDecoding?: unknown;
  hooks?: unknown;
  maxTokens?: number;
  [key: string]: unknown;
}

export interface InferenceMessagesPayload<TMessage extends MemoryMessage = MemoryMessage> {
  messages: TMessage[];
}

export interface WorkspaceFile {
  path: string;
  content: string;
}

export interface HarnessToolContext {
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
}

export interface HarnessToolDefinition {
  id: string;
  label?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  execute: (args: unknown, context?: HarnessToolContext) => unknown;
}

export interface HarnessToolRegistry {
  register(definition: HarnessToolDefinition): void;
  get(id: string): HarnessToolDefinition | undefined;
  execute(id: string, args: unknown): Promise<unknown>;
}

export interface HarnessCommandContext {
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
}

export interface HarnessCommandDefinition {
  id: string;
  usage?: string;
  description: string;
  pattern: RegExp;
  target:
    | {
      type: 'handler';
      run: (args: Record<string, string | undefined>, context: HarnessCommandContext) => unknown;
    }
    | {
      type: 'prompt-template';
      template: (
        args: Record<string, string | undefined>,
        match: { groups: Record<string, string | undefined> },
      ) => string;
    };
  parseArgs?: (match: { groups: Record<string, string | undefined> }) => Record<string, string | undefined>;
}

export interface HarnessCommandRegistry {
  register(definition: HarnessCommandDefinition): void;
  execute(input: string): Promise<unknown>;
  list(): HarnessCommandDefinition[];
}

export interface HarnessHookPipeInput<TPayload> {
  payload: TPayload;
  metadata: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface HarnessHookPipeDefinition<TPayload = unknown> {
  id: string;
  point: string;
  kind: 'deterministic' | string;
  priority?: number;
  run: (input: HarnessHookPipeInput<TPayload>) => unknown;
}

export interface HarnessHookRegistry<TPayload = unknown> {
  registerPipe(definition: HarnessHookPipeDefinition<TPayload>): void;
  run<TInput extends TPayload = TPayload>(
    point: string,
    payload: TInput,
    options?: { metadata?: Record<string, unknown> },
  ): Promise<{
    payload: TInput;
    output?: unknown;
    outputs: Array<{ hookId: string; output: unknown }>;
  }>;
  runPipes<TInput extends TPayload = TPayload>(
    point: string,
    payload: TInput,
  ): Promise<{
    payload: TInput;
    output?: unknown;
    outputs: Array<{ hookId: string; output: unknown }>;
  }>;
}

export interface Artifact {
  id: string;
  title?: string;
  data?: unknown;
  mediaType?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactBody {
  data?: unknown;
  mediaType?: string;
  metadata: Record<string, unknown>;
}

export interface ArtifactSnapshot extends ArtifactBody {
  artifact: Artifact;
}

export class ArtifactRegistry {
  constructor(options?: Record<string, unknown>);
  create(input: Partial<Artifact> & { id?: string; data?: unknown }): Promise<Artifact>;
  read(id: string | Artifact): Promise<ArtifactSnapshot | undefined>;
  write(id: string, input: Partial<ArtifactBody>): Promise<Artifact>;
  list(): Iterable<Artifact>;
  registerRemote(input: Record<string, unknown>): void;
}

export interface HarnessArtifactRegistry {
  create(input: Partial<Artifact> & { id?: string; data?: unknown }): Promise<Artifact>;
  read(id: string | Artifact): Promise<ArtifactSnapshot | undefined>;
  write(id: string, input: Partial<ArtifactBody>): Promise<Artifact>;
  list(): Iterable<Artifact>;
  registerRemote(input: Record<string, unknown>): void;
}

export interface HarnessPluginContext<THookPayload = unknown> {
  artifacts: HarnessArtifactRegistry;
  commands: HarnessCommandRegistry;
  hooks: HarnessHookRegistry<THookPayload>;
  tools: HarnessToolRegistry;
}

export interface HarnessPlugin<
  TMessage extends MemoryMessage = MemoryMessage,
  THookPayload = unknown,
> {
  id: string;
  register(context: HarnessPluginContext<THookPayload>): void | Promise<void>;
}

export interface HarnessPluginRegistry {
  load(plugin: HarnessPlugin): Promise<void>;
  list(): HarnessPlugin[];
}

export interface HarnessExtensionContext<
  TMessage extends MemoryMessage = MemoryMessage,
  THookPayload = unknown,
> extends HarnessPluginContext<THookPayload> {
  plugins: HarnessPluginRegistry;
}

export function createHarnessExtensionContext<
  TMessage extends MemoryMessage = MemoryMessage,
  THookPayload = unknown,
>(options?: { artifacts?: ArtifactRegistry }): HarnessExtensionContext<TMessage, THookPayload>;

export function constrainToJsonSchema(
  schema: JsonSchema,
  options?: Record<string, unknown>,
): Record<string, unknown>;

export function decodeConstrainedOutput(
  text: string,
  decoding: Record<string, unknown>,
): unknown;
