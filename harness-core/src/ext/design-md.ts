import {
  constrainToJsonSchema,
  decodeConstrainedOutput,
  type CoreInferenceClient,
  type CoreMessage,
  type JsonSchema,
} from '../constrainedDecoding.js';
import type { MemoryMessage } from '../memory.js';
import type { InferenceMessagesPayload, HarnessPlugin } from '../plugins.js';
import type { HarnessToolContext } from '../tools.js';

export interface DesignMdDocument {
  path: string;
  content: string;
}

export interface DesignMdApplyTarget {
  path: string;
  content: string;
}

export interface DesignMdApplyIntent {
  kind: 'code-substitution' | 'guidance' | 'tooling';
}

export interface DesignMdApplyRequest {
  design: DesignMdDocument;
  target: DesignMdApplyTarget;
  intent: DesignMdApplyIntent;
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface DesignMdCodeSubstitution {
  providerId: string;
  targetPath: string;
  method: 'marker-insert' | 'marker-replace' | 'exact-replace';
  description: string;
}

export interface DesignMdApplyResult {
  providerId: string;
  targetPath: string;
  content: string;
  substitutions: DesignMdCodeSubstitution[];
  diagnostics: string[];
  usedTooling: string[];
}

export interface DesignMdApplyProvider {
  id: string;
  description: string;
  canApply(request: DesignMdApplyRequest): boolean;
  apply(request: DesignMdApplyRequest): Promise<DesignMdApplyResult> | DesignMdApplyResult;
}

export interface DesignMdSemanticHookInput {
  messages?: readonly Pick<CoreMessage, 'role' | 'content'>[];
  targetPath?: string;
  metadata?: Record<string, unknown>;
}

export interface DesignMdSemanticHook {
  id: string;
  matches(input: DesignMdSemanticHookInput): boolean;
}

export interface DesignMdPluginOptions {
  documents: readonly DesignMdDocument[];
  applyProviders?: readonly DesignMdApplyProvider[];
  point?: string;
  priority?: number;
}

export interface LlGuidanceDesignSubstitutionProviderOptions {
  inferenceClient: CoreInferenceClient;
}

interface ParsedDesignMd {
  name: string;
  prose: string;
  colors: Record<string, string>;
  typography: Record<string, Record<string, string>>;
  rounded: Record<string, string>;
  spacing: Record<string, string>;
}

interface DesignMdApplyToolArgs {
  targetPath?: string;
  targetContent?: string;
  providerId?: string;
  designPath?: string;
  intent?: DesignMdApplyIntent['kind'];
}

interface SubstitutionPlan {
  substitutions: Array<{
    find: string;
    replace: string;
    description: string;
  }>;
  diagnostics: string[];
}

const DESIGN_MD_GUIDANCE_HOOK_ID = 'design-md.semantic-guidance';
const DESIGN_LANGUAGE_PATTERN = /\b(brand|color|component|css|design|font|front[- ]?end|layout|palette|polish(?:ed)?|react|screen|style|tailwind|theme|tsx|typography|ui|ux|visual)\b/i;
const FRONTEND_CODE_PATH_PATTERN = /\.(css|html|jsx|tsx)$|(^|\/)(tailwind\.config|app|components?|pages?|styles?)(\/|\.|$)/i;
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const DESIGN_MARKER_START = '/* design.md:start */';
const DESIGN_MARKER_END = '/* design.md:end */';

export const DESIGN_MD_SUBSTITUTION_PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    substitutions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          find: { type: 'string' },
          replace: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['find', 'replace', 'description'],
      },
    },
    diagnostics: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['substitutions', 'diagnostics'],
} satisfies JsonSchema;

const DEFAULT_SEMANTIC_HOOKS: readonly DesignMdSemanticHook[] = [
  {
    id: 'design-language',
    matches: ({ messages, metadata }) => DESIGN_LANGUAGE_PATTERN.test([
      messages?.map((message) => message.content).join('\n') ?? '',
      String(metadata?.task ?? ''),
      String(metadata?.intent ?? ''),
    ].join('\n')),
  },
  {
    id: 'frontend-code-path',
    matches: ({ targetPath, metadata }) => FRONTEND_CODE_PATH_PATTERN.test([
      targetPath ?? '',
      String(metadata?.targetPath ?? ''),
    ].join('\n')),
  },
];

export function discoverDesignMdSemanticHooks(input: DesignMdSemanticHookInput): DesignMdSemanticHook[] {
  return DEFAULT_SEMANTIC_HOOKS.filter((hook) => hook.matches(input));
}

export function createDesignMdPlugin<TMessage extends MemoryMessage = MemoryMessage>(
  options: DesignMdPluginOptions,
): HarnessPlugin<TMessage, InferenceMessagesPayload<TMessage>> {
  const providers = options.applyProviders ?? [
    createCssDesignTokenApplyProvider(),
  ];
  return {
    id: 'design-md',
    register({ hooks, tools }) {
      hooks.registerPipe({
        id: DESIGN_MD_GUIDANCE_HOOK_ID,
        point: options.point ?? 'before-llm-messages',
        kind: 'deterministic',
        priority: options.priority ?? -9_000,
        run: ({ payload, metadata }) => {
          const document = options.documents[0];
          if (!document) {
            return { output: { applied: false, reason: 'no-design-md-document' } };
          }

          const messages = extractMessages(payload);
          const targetPath = typeof metadata.targetPath === 'string' ? metadata.targetPath : undefined;
          const semanticHooks = discoverDesignMdSemanticHooks({ messages, metadata, targetPath });
          if (!semanticHooks.length) {
            return { output: { applied: false, reason: 'no-semantic-hook-match' } };
          }

          return {
            payload: {
              ...payload,
              messages: [
                { role: 'system', content: buildDesignMdGuidanceMessage(document) } as unknown as TMessage,
                ...(messages as unknown as TMessage[]),
              ],
            },
            output: {
              applied: true,
              designPath: document.path,
              semanticHooks: semanticHooks.map((hook) => hook.id),
            },
          };
        },
      });

      tools.register({
        id: 'design-md.apply',
        description: 'Apply DESIGN.md visual standards to a target file through a registered provider adapter.',
        inputSchema: {
          type: 'object',
          properties: {
            targetPath: { type: 'string' },
            targetContent: { type: 'string' },
            providerId: { type: 'string' },
            designPath: { type: 'string' },
            intent: { type: 'string', enum: ['code-substitution', 'guidance', 'tooling'] },
          },
          required: ['targetPath', 'targetContent'],
        },
        execute: (args, context) => executeDesignMdApplyTool(args as DesignMdApplyToolArgs, context, options.documents, providers),
      });
    },
  };
}

export function createCssDesignTokenApplyProvider(): DesignMdApplyProvider {
  return {
    id: 'css-design-tokens',
    description: 'Render DESIGN.md tokens into a managed CSS custom-property block.',
    canApply: (request) => request.intent.kind === 'code-substitution' && /\.css$/i.test(request.target.path),
    apply: (request) => {
      const block = renderCssTokenBlock(parseDesignMd(request.design));
      const existingBlock = new RegExp(`${escapeRegExp(DESIGN_MARKER_START)}[\\s\\S]*?${escapeRegExp(DESIGN_MARKER_END)}\\r?\\n?`);
      const hasBlock = existingBlock.test(request.target.content);
      const content = hasBlock
        ? request.target.content.replace(existingBlock, `${block}\n`)
        : `${block}\n${request.target.content}`;

      return {
        providerId: 'css-design-tokens',
        targetPath: request.target.path,
        content,
        substitutions: [{
          providerId: 'css-design-tokens',
          targetPath: request.target.path,
          method: hasBlock ? 'marker-replace' : 'marker-insert',
          description: 'Synchronize CSS custom properties from DESIGN.md tokens.',
        }],
        diagnostics: [],
        usedTooling: ['design-md-token-parser', 'css-custom-property-substitution'],
      };
    },
  };
}

export function createLlGuidanceDesignSubstitutionProvider(
  options: LlGuidanceDesignSubstitutionProviderOptions,
): DesignMdApplyProvider {
  return {
    id: 'llguidance-substitution-plan',
    description: 'Use llguidance-constrained JSON to plan exact code substitutions, then apply them deterministically.',
    canApply: (request) => request.intent.kind === 'code-substitution' && !/\.css$/i.test(request.target.path),
    async apply(request) {
      const text = await options.inferenceClient.infer([
        {
          role: 'system',
          content: [
            'Return only a substitution plan that applies DESIGN.md standards.',
            'Use exact find/replace snippets from the target content.',
            'Do not return prose or a patch.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            `DESIGN.md (${request.design.path})`,
            request.design.content,
            `Target (${request.target.path})`,
            request.target.content,
          ].join('\n\n'),
        },
      ], {
        constrainedDecoding: constrainToJsonSchema(DESIGN_MD_SUBSTITUTION_PLAN_SCHEMA, { maxTokens: 2_048 }),
      });
      const plan = decodeConstrainedOutput(text, constrainToJsonSchema(DESIGN_MD_SUBSTITUTION_PLAN_SCHEMA)) as SubstitutionPlan;
      const applied = applyExactSubstitutionPlan(request.target.content, plan);

      return {
        providerId: 'llguidance-substitution-plan',
        targetPath: request.target.path,
        content: applied.content,
        substitutions: applied.substitutions.map((substitution) => ({
          providerId: 'llguidance-substitution-plan',
          targetPath: request.target.path,
          method: 'exact-replace',
          description: substitution.description,
        })),
        diagnostics: plan.diagnostics,
        usedTooling: ['llguidance-json-schema', 'exact-code-substitution'],
      };
    },
  };
}

export function buildDesignMdGuidanceMessage(document: DesignMdDocument): string {
  const parsed = parseDesignMd(document);
  return [
    `DESIGN.md: ${parsed.name}`,
    `Source: ${document.path}`,
    formatTokenSummary(parsed),
    'Apply these design tokens as normative values. Use the markdown rationale for taste, hierarchy, and exceptions.',
    parsed.prose.trim(),
  ].filter(Boolean).join('\n\n');
}

async function executeDesignMdApplyTool(
  args: DesignMdApplyToolArgs,
  context: HarnessToolContext | undefined,
  documents: readonly DesignMdDocument[],
  providers: readonly DesignMdApplyProvider[],
): Promise<DesignMdApplyResult> {
  const design = documents.find((document) => document.path === args.designPath) ?? documents[0];
  if (!design) throw new Error('No DESIGN.md document is available.');
  const target = {
    path: args.targetPath ?? '',
    content: args.targetContent ?? '',
  };
  const request: DesignMdApplyRequest = {
    design,
    target,
    intent: { kind: args.intent ?? 'code-substitution' },
    metadata: context?.metadata,
    signal: context?.signal,
  };
  const provider = args.providerId
    ? providers.find((candidate) => candidate.id === args.providerId)
    : providers.find((candidate) => candidate.canApply(request));
  if (!provider) {
    throw new Error(args.providerId
      ? `Unknown design.md apply provider: ${args.providerId}`
      : `No design.md apply provider can handle ${target.path}`);
  }
  return provider.apply(request);
}

function extractMessages<TMessage extends MemoryMessage>(payload: InferenceMessagesPayload<TMessage>): CoreMessage[] {
  return payload.messages.map((message) => {
    const candidate = message as Partial<CoreMessage>;
    return {
      role: candidate.role ?? 'user',
      content: String(candidate.content ?? ''),
    } as CoreMessage;
  });
}

function parseDesignMd(document: DesignMdDocument): ParsedDesignMd {
  const match = FRONTMATTER_PATTERN.exec(document.content);
  const frontmatter = match?.[1] ?? '';
  const prose = match ? document.content.slice(match[0].length) : document.content;
  const parsed = parseSimpleYaml(frontmatter);
  return {
    name: stringRecordValue(parsed, 'name') ?? document.path,
    prose,
    colors: nestedStringRecord(parsed, 'colors'),
    typography: doubleNestedStringRecord(parsed, 'typography'),
    rounded: nestedStringRecord(parsed, 'rounded'),
    spacing: nestedStringRecord(parsed, 'spacing'),
  };
}

function formatTokenSummary(parsed: ParsedDesignMd): string {
  const colors = Object.entries(parsed.colors).map(([key, value]) => `${key} ${value}`).join('; ');
  const typography = Object.entries(parsed.typography).map(([key, value]) => {
    const details = [value.fontFamily, value.fontSize].filter(Boolean).join(' ');
    return details ? `${key} ${details}` : key;
  }).join('; ');
  return [
    colors ? `Colors: ${colors}` : '',
    typography ? `Typography: ${typography}` : '',
  ].filter(Boolean).join('\n');
}

function renderCssTokenBlock(parsed: ParsedDesignMd): string {
  return [
    DESIGN_MARKER_START,
    ':root {',
    ...Object.entries(parsed.colors).map(([key, value]) => `  --design-color-${key}: ${value};`),
    ...Object.entries(parsed.typography).flatMap(([key, typography]) => Object.entries(typography).map(([property, value]) => {
      const cssProperty = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      return `  --design-${cssProperty}-${key}: ${value};`;
    })),
    ...Object.entries(parsed.rounded).map(([key, value]) => `  --design-radius-${key}: ${value};`),
    ...Object.entries(parsed.spacing).map(([key, value]) => `  --design-space-${key}: ${value};`),
    '}',
    DESIGN_MARKER_END,
  ].join('\n');
}

function parseSimpleYaml(source: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; value: Record<string, unknown> }> = [{ indent: -1, value: root }];
  for (const rawLine of source.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith('#')) continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    const [rawKey, ...rawValueParts] = rawLine.trim().split(':');
    const key = rawKey.trim();
    const rawValue = rawValueParts.join(':').trim();
    while (stack.at(-1) && indent <= stack.at(-1)!.indent) stack.pop();
    const parent = stack.at(-1)!.value;
    if (rawValue) {
      parent[key] = unquoteYamlScalar(rawValue);
    } else {
      const child: Record<string, unknown> = {};
      parent[key] = child;
      stack.push({ indent, value: child });
    }
  }
  return root;
}

function nestedStringRecord(source: Record<string, unknown>, key: string): Record<string, string> {
  const value = source[key];
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, String(entryValue)]));
}

function doubleNestedStringRecord(source: Record<string, unknown>, key: string): Record<string, Record<string, string>> {
  const value = source[key];
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [
    entryKey,
    isRecord(entryValue)
      ? Object.fromEntries(Object.entries(entryValue).map(([property, propertyValue]) => [property, String(propertyValue)]))
      : {},
  ]));
}

function stringRecordValue(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

function unquoteYamlScalar(value: string): string {
  return value.replace(/^["']|["']$/g, '');
}

function applyExactSubstitutionPlan(content: string, plan: SubstitutionPlan): { content: string; substitutions: Array<{ description: string }> } {
  return plan.substitutions.reduce((current, substitution) => {
    if (!current.content.includes(substitution.find)) return current;
    return {
      content: current.content.replaceAll(substitution.find, substitution.replace),
      substitutions: [...current.substitutions, { description: substitution.description }],
    };
  }, { content, substitutions: [] as Array<{ description: string }> });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
