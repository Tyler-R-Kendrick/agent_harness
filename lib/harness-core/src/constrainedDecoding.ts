import { toJSONSchema as zodToJsonSchema } from 'zod';
import {
  buildToonLlGuidanceGrammar,
  decodeToonDocument,
} from './toonGrammar.js';

export type CoreMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export interface CoreInferenceOptions {
  constrainedDecoding?: ConstrainedDecoding;
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

export function toGuidanceTsGrammar(decoding: GuidanceGrammarInput): GuidanceTsGrammar {
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
    return grammarFromSerialized(buildToonLlGuidanceGrammar(decoding.maxTokens));
  }

  if (decoding.grammar) {
    return toGuidanceTsGrammar(decoding.grammar);
  }

  if (decoding.format === 'toon') {
    return grammarFromSerialized(buildToonLlGuidanceGrammar(decoding.maxTokens));
  }

  return grammarFromSerialized(jsonSchemaGrammar(resolveZodJsonSchema(decoding), decoding.maxTokens));
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
      const grammar = toGuidanceTsGrammar(constrainedDecoding);
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
    ? decodeToonOutput(text, { decode: decoding.decodeToon })
    : JSON.parse(text);

  return (decoding.schema as ZodLikeSchema<TDecoded>).parse(value);
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

async function loadGuidanceTsRuntime(): Promise<GuidanceTsRuntime> {
  guidanceTsRuntimePromise ??= import(GUIDANCE_TS_MODULE_SPECIFIER) as Promise<unknown> as Promise<GuidanceTsRuntime>;
  return guidanceTsRuntimePromise;
}

function decodeToonOutput<TDecoded>(
  text: string,
  decoding: Pick<ToonConstrainedDecoding<TDecoded>, 'decode'>,
): TDecoded | unknown {
  if (decoding.decode) {
    return decoding.decode(text);
  }

  return decodeToonDocument(text);
}
