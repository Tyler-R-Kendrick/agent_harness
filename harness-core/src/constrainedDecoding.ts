import { toJSONSchema as zodToJsonSchema } from 'zod';
import type { HookRegistry, HarnessHookRunOptions } from './hooks.js';

export type CoreMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export interface CoreInferenceOptions {
  constrainedDecoding?: ConstrainedDecoding;
  hooks?: HookRegistry;
  maxTokens?: number;
}

export interface CoreInferenceClient {
  infer(messages: CoreMessage[], options?: CoreInferenceOptions): Promise<string>;
}

export type JsonSchema = Record<string, unknown>;

export interface GuidanceSerializedGrammar {
  grammars: Array<Record<string, unknown>>;
  max_tokens?: number;
}

export interface GuidanceTsGrammar {
  serialize(): GuidanceSerializedGrammar | unknown;
}

export type GuidanceGrammarInput = ConstrainedDecoding | GuidanceTsGrammar | GuidanceSerializedGrammar;

export interface GuidanceGrammarResolutionOptions {
  hooks?: HookRegistry;
  hookOptions?: HarnessHookRunOptions;
}

export const CONSTRAINED_DECODING_GRAMMAR_HOOK_POINT = 'produce-output:constrained-grammar';
export const CONSTRAINED_DECODING_DECODE_HOOK_POINT = 'produce-output:decode-constrained-text';

export interface ConstrainedOutputGrammarHookPayload {
  decoding: ConstrainedDecoding;
  grammar?: GuidanceGrammarInput;
}

export interface ConstrainedOutputDecodeHookPayload<TDecoded = unknown> {
  text: string;
  decoding: ConstrainedDecoding<TDecoded>;
  decoded?: TDecoded | unknown;
}

export interface JsonSchemaConstrainedDecoding {
  kind: 'json_schema';
  schema: JsonSchema;
  maxTokens?: number;
  grammar?: GuidanceGrammarInput;
}

export interface LarkConstrainedDecoding<TDecoded = string> {
  kind: 'lark';
  grammar: string;
  maxTokens?: number;
  parse?: (text: string) => TDecoded;
}

export interface ToonConstrainedDecoding<TDecoded = unknown> {
  kind: 'toon';
  maxTokens?: number;
  grammar?: GuidanceGrammarInput;
  decode?: (text: string) => TDecoded;
}

export interface ZodLikeSchema<TDecoded = unknown> {
  parse(value: unknown): TDecoded;
}

export interface ZodConstrainedDecoding<TSchema = unknown, TDecoded = unknown> {
  kind: 'zod';
  schema: TSchema;
  format?: 'json' | 'toon';
  maxTokens?: number;
  grammar?: GuidanceGrammarInput;
  toJsonSchema?(schema: TSchema): JsonSchema;
  decodeToon?(text: string): unknown;
  readonly decodedType?: TDecoded;
}

export type ConstrainedDecoding<TDecoded = unknown> =
  | JsonSchemaConstrainedDecoding
  | LarkConstrainedDecoding<TDecoded>
  | ToonConstrainedDecoding<TDecoded>
  | ZodConstrainedDecoding<unknown, TDecoded>;

export interface GuidanceServerSettings {
  guidanceServerUrl: string;
  apiKey?: string;
}

export interface GuidanceTsInferenceClientOptions {
  settings: GuidanceServerSettings;
  fallback: CoreInferenceClient;
  hooks?: HookRegistry;
  maxTokens?: number;
}

interface GuidanceSession {
  generation(options: {
    messages: CoreMessage[];
    grammar: GuidanceTsGrammar;
    maxTokens?: number;
  }): {
    run(): Promise<void>;
    getText(): string;
  };
}

interface GuidanceTsRuntime {
  Session: new (connectionString: string) => GuidanceSession;
}

const GUIDANCE_TS_MODULE_SPECIFIER = 'guidance-ts/src/index';
let guidanceTsRuntimePromise: Promise<GuidanceTsRuntime> | undefined;

export function constrainToJsonSchema(
  schema: JsonSchema,
  options: Omit<JsonSchemaConstrainedDecoding, 'kind' | 'schema'> = {},
): JsonSchemaConstrainedDecoding {
  return { kind: 'json_schema', schema, ...options };
}

export function constrainToLarkGrammar<TDecoded = string>(
  grammar: string,
  options: Omit<LarkConstrainedDecoding<TDecoded>, 'kind' | 'grammar'> = {},
): LarkConstrainedDecoding<TDecoded> {
  return { kind: 'lark', grammar, ...options };
}

export function constrainToToon<TDecoded = unknown>(
  options: Omit<ToonConstrainedDecoding<TDecoded>, 'kind'> = {},
): ToonConstrainedDecoding<TDecoded> {
  return { kind: 'toon', ...options };
}

export function constrainToZod<TSchema, TDecoded>(
  schema: TSchema,
  options: Omit<ZodConstrainedDecoding<TSchema, TDecoded>, 'kind' | 'schema'> = {},
): ZodConstrainedDecoding<TSchema, TDecoded> {
  return { kind: 'zod', schema, ...options };
}

export function toGuidanceTsGrammar(
  decoding: GuidanceGrammarInput,
): GuidanceTsGrammar {
  if (isGuidanceTsGrammar(decoding)) {
    return decoding;
  }

  if (isSerializedGrammar(decoding)) {
    return grammarFromSerialized(decoding);
  }

  if (decoding.kind === 'json_schema') {
    if (decoding.grammar) {
      return toGuidanceTsGrammar(decoding.grammar);
    }
    return grammarFromSerialized(jsonSchemaGrammar(decoding.schema, decoding.maxTokens));
  }

  if (decoding.kind === 'lark') {
    return grammarFromSerialized(larkGrammar(decoding.grammar, 'lark_grammar', decoding.maxTokens));
  }

  if (decoding.kind === 'toon') {
    if (decoding.grammar) {
      return toGuidanceTsGrammar(decoding.grammar);
    }
    throw new Error('No constrained decoding hook resolved toon.');
  }

  if (decoding.grammar) {
    return toGuidanceTsGrammar(decoding.grammar);
  }

  if (decoding.format === 'toon') {
    throw new Error('No constrained decoding hook resolved toon.');
  }

  return grammarFromSerialized(jsonSchemaGrammar(resolveZodJsonSchema(decoding), decoding.maxTokens));
}

export async function resolveGuidanceTsGrammar(
  decoding: GuidanceGrammarInput,
  options: GuidanceGrammarResolutionOptions = {},
): Promise<GuidanceTsGrammar> {
  if (isConstrainedDecoding(decoding) && decoding.kind === 'json_schema' && decoding.grammar) {
    return resolveGuidanceTsGrammar(decoding.grammar, options);
  }

  if (isConstrainedDecoding(decoding) && decoding.kind === 'toon' && decoding.grammar) {
    return resolveGuidanceTsGrammar(decoding.grammar, options);
  }

  if (isConstrainedDecoding(decoding) && decoding.kind === 'zod' && decoding.grammar) {
    return resolveGuidanceTsGrammar(decoding.grammar, options);
  }

  if (isConstrainedDecoding(decoding) && decoding.kind === 'toon' && !decoding.grammar) {
    return resolveGuidanceTsGrammarFromHooks(decoding, options);
  }

  if (
    isConstrainedDecoding(decoding)
    && decoding.kind === 'zod'
    && decoding.format === 'toon'
    && !decoding.grammar
  ) {
    return resolveGuidanceTsGrammarFromHooks(constrainToToon({ maxTokens: decoding.maxTokens }), options);
  }

  return toGuidanceTsGrammar(decoding);
}

export function createGuidanceTsInferenceClient(
  options: GuidanceTsInferenceClientOptions,
): CoreInferenceClient {
  return {
    async infer(messages, requestOptions) {
      const constrainedDecoding = requestOptions?.constrainedDecoding;
      if (!constrainedDecoding) {
        return options.fallback.infer(messages, requestOptions);
      }

      const guidance = await loadGuidanceTsRuntime();
      const session = new guidance.Session(guidanceConnectionString(options.settings));
      const grammar = await resolveGuidanceTsGrammar(constrainedDecoding, {
        hooks: requestOptions?.hooks ?? options.hooks,
      });
      const maxTokens = requestOptions?.maxTokens ?? constrainedDecoding.maxTokens ?? options.maxTokens;
      const generation = session.generation({
        messages: messages.map((message) => ({ role: message.role, content: message.content })),
        grammar,
        ...(maxTokens !== undefined ? { maxTokens } : {}),
      });

      await generation.run();
      return generation.getText();
    },
  };
}

export function guidanceConnectionString(settings: GuidanceServerSettings): string {
  const guidanceServerUrl = settings.guidanceServerUrl.trim();
  if (guidanceServerUrl.length === 0) {
    throw new Error('guidanceServerUrl is required for guidance-ts constrained decoding.');
  }

  if (!settings.apiKey || guidanceServerUrl.includes('#')) {
    return guidanceServerUrl;
  }

  return `${guidanceServerUrl}#key=${encodeURIComponent(settings.apiKey)}`;
}

export function decodeConstrainedOutput<TDecoded>(
  text: string,
  decoding: ConstrainedDecoding<TDecoded>,
): TDecoded | unknown {
  if (decoding.kind === 'json_schema') {
    return JSON.parse(text);
  }

  if (decoding.kind === 'lark') {
    if (decoding.parse) {
      return decoding.parse(text);
    }
    return text;
  }

  if (decoding.kind === 'toon') {
    return decodeToonOutput(text, decoding);
  }

  const value = decoding.format === 'toon'
    ? decodeToonOutput(text, { kind: 'toon', maxTokens: decoding.maxTokens, decode: decoding.decodeToon })
    : JSON.parse(text);

  return (decoding.schema as ZodLikeSchema<TDecoded>).parse(value);
}

export async function decodeConstrainedOutputWithHooks<TDecoded>(
  text: string,
  decoding: ConstrainedDecoding<TDecoded>,
  options: GuidanceGrammarResolutionOptions = {},
): Promise<TDecoded | unknown> {
  if (decoding.kind === 'toon' && !decoding.decode) {
    return decodeConstrainedOutputFromHooks(text, decoding, options);
  }

  if (decoding.kind === 'zod' && decoding.format === 'toon' && !decoding.decodeToon) {
    const decoded = await decodeConstrainedOutputFromHooks(text, constrainToToon({ maxTokens: decoding.maxTokens }), options);
    return (decoding.schema as ZodLikeSchema<TDecoded>).parse(decoded);
  }

  return decodeConstrainedOutput(text, decoding);
}

function grammarFromSerialized(grammar: GuidanceSerializedGrammar | unknown): GuidanceTsGrammar {
  return {
    serialize: () => grammar,
  };
}

function jsonSchemaGrammar(schema: JsonSchema, maxTokens: number | undefined): GuidanceSerializedGrammar {
  return addMaxTokens({
    grammars: [{ name: 'json_schema', json_schema: schema }],
  }, maxTokens);
}

function larkGrammar(grammar: string, name: string, maxTokens: number | undefined): GuidanceSerializedGrammar {
  return addMaxTokens({
    grammars: [{ name, lark_grammar: grammar }],
  }, maxTokens);
}

function addMaxTokens(grammar: GuidanceSerializedGrammar, maxTokens: number | undefined): GuidanceSerializedGrammar {
  if (maxTokens === undefined) {
    return grammar;
  }
  return { ...grammar, max_tokens: maxTokens };
}

function isGuidanceTsGrammar(value: unknown): value is GuidanceTsGrammar {
  return isRecord(value) && typeof value.serialize === 'function';
}

function isSerializedGrammar(value: unknown): value is GuidanceSerializedGrammar {
  return isRecord(value) && Array.isArray(value.grammars);
}

function isConstrainedDecoding(value: GuidanceGrammarInput): value is ConstrainedDecoding {
  return isRecord(value) && typeof value.kind === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function resolveZodJsonSchema<TSchema>(
  decoding: ZodConstrainedDecoding<TSchema>,
): JsonSchema {
  if (decoding.toJsonSchema) {
    try {
      return decoding.toJsonSchema(decoding.schema);
    } catch {
      throw new Error('Unable to convert Zod schema to JSON Schema. Pass toJsonSchema for this schema.');
    }
  }

  try {
    return zodToJsonSchema(decoding.schema as Parameters<typeof zodToJsonSchema>[0]) as JsonSchema;
  } catch {
    throw new Error('Unable to convert Zod schema to JSON Schema. Pass toJsonSchema for this schema.');
  }
}

async function resolveGuidanceTsGrammarFromHooks(
  decoding: ConstrainedDecoding,
  options: GuidanceGrammarResolutionOptions,
): Promise<GuidanceTsGrammar> {
  const result = await options.hooks?.runPipes<ConstrainedOutputGrammarHookPayload>(
    CONSTRAINED_DECODING_GRAMMAR_HOOK_POINT,
    { decoding },
    options.hookOptions,
  );
  if (result?.payload.grammar) {
    return toGuidanceTsGrammar(result.payload.grammar);
  }
  throw new Error(`No constrained decoding hook resolved ${decoding.kind}.`);
}

async function loadGuidanceTsRuntime(): Promise<GuidanceTsRuntime> {
  guidanceTsRuntimePromise ??= import(GUIDANCE_TS_MODULE_SPECIFIER) as Promise<unknown> as Promise<GuidanceTsRuntime>;
  return guidanceTsRuntimePromise;
}

function decodeToonOutput<TDecoded>(
  text: string,
  decoding: ToonConstrainedDecoding<TDecoded>,
): TDecoded | unknown {
  if (decoding.decode) {
    return decoding.decode(text);
  }

  throw new Error('No constrained decoding hook resolved toon output.');
}

async function decodeConstrainedOutputFromHooks<TDecoded>(
  text: string,
  decoding: ToonConstrainedDecoding<TDecoded>,
  options: GuidanceGrammarResolutionOptions,
): Promise<TDecoded | unknown> {
  const result = await options.hooks?.runPipes<ConstrainedOutputDecodeHookPayload<TDecoded>>(
    CONSTRAINED_DECODING_DECODE_HOOK_POINT,
    { text, decoding },
    options.hookOptions,
  );
  if (result && Object.prototype.hasOwnProperty.call(result.payload, 'decoded')) {
    return result.payload.decoded;
  }
  throw new Error('No constrained decoding hook resolved toon output.');
}
