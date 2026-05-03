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

export interface DesignMdThemeOption {
  id: string;
  label: string;
}

export interface DesignMdCssRenderOptions {
  themeId?: string;
}

export interface DesignMdCssRenderResult {
  css: string;
  diagnostics: string[];
  variables: Record<string, string>;
  themeId: string;
}

interface DesignMdTokenGroups {
  colors: Record<string, string>;
  typography: Record<string, Record<string, string>>;
  rounded: Record<string, string>;
  spacing: Record<string, string>;
  shadows: Record<string, string>;
  motion: Record<string, string>;
}

interface ParsedDesignMd extends DesignMdTokenGroups {
  name: string;
  prose: string;
  themes: Record<string, DesignMdTokenGroups>;
  styles: DesignMdStyles;
}

interface DesignMdStyles {
  agentBrowser: Record<string, string>;
  widgets: Record<string, Record<string, string>>;
}

interface TokenReferenceEntry {
  reference: string;
  variable: string;
  value: string;
}

interface TokenReferenceIndex {
  entries: TokenReferenceEntry[];
  byReference: Map<string, TokenReferenceEntry>;
}

interface StyleDeclarationRender {
  cssLines: string[];
  variables: Record<string, string>;
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
const DESIGN_TOKEN_REFERENCE_GROUPS = new Set(['colors', 'typography', 'rounded', 'spacing', 'shadows', 'motion']);

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
      const rendered = renderDesignMdCss(request.design);
      const block = rendered.css;
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
        diagnostics: rendered.diagnostics,
        usedTooling: ['design-md-token-parser', 'design-md-theme-resolver', 'css-custom-property-substitution'],
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

export function listDesignMdThemeOptions(document: DesignMdDocument): DesignMdThemeOption[] {
  const parsed = parseDesignMd(document);
  return [
    { id: 'default', label: parsed.name },
    ...Object.keys(parsed.themes).map((id) => ({ id, label: id })),
  ];
}

export function renderDesignMdCss(
  document: DesignMdDocument,
  options: DesignMdCssRenderOptions = {},
): DesignMdCssRenderResult {
  const parsed = parseDesignMd(document);
  const diagnostics: string[] = [];
  const { themeId, tokens } = resolveThemeTokens(parsed, options.themeId, diagnostics);
  const tokenReferences = buildTokenReferenceIndex(tokens, diagnostics);
  const shellDeclarations = renderStyleDeclarations(
    parsed.styles.agentBrowser,
    'styles.agentBrowser',
    tokenReferences,
    diagnostics,
    true,
  );
  const widgetBlocks = renderWidgetBlocks(parsed.styles.widgets, tokenReferences, diagnostics);
  return {
    themeId,
    diagnostics,
    variables: shellDeclarations.variables,
    css: [
      DESIGN_MARKER_START,
      ':root {',
      ...tokenReferences.entries.map((entry) => `  ${entry.variable}: ${entry.value};`),
      ...shellDeclarations.cssLines,
      '}',
      ...widgetBlocks,
      DESIGN_MARKER_END,
    ].join('\n'),
  };
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
    shadows: nestedStringRecord(parsed, 'shadows'),
    motion: nestedStringRecord(parsed, 'motion'),
    themes: parseThemeRecords(parsed),
    styles: parseStyleRecords(parsed),
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

function resolveThemeTokens(
  parsed: ParsedDesignMd,
  requestedThemeId: string | undefined,
  diagnostics: string[],
): { themeId: string; tokens: DesignMdTokenGroups } {
  const baseTokens = pickBaseTokens(parsed);
  if (!requestedThemeId || requestedThemeId === 'default') {
    return { themeId: 'default', tokens: baseTokens };
  }

  const theme = parsed.themes[requestedThemeId];
  if (!theme) {
    diagnostics.push(`Unknown DESIGN.md theme "${requestedThemeId}"; using default tokens.`);
    return { themeId: 'default', tokens: baseTokens };
  }

  return {
    themeId: requestedThemeId,
    tokens: mergeTokenGroups(baseTokens, theme),
  };
}

function pickBaseTokens(parsed: ParsedDesignMd): DesignMdTokenGroups {
  return {
    colors: parsed.colors,
    typography: parsed.typography,
    rounded: parsed.rounded,
    spacing: parsed.spacing,
    shadows: parsed.shadows,
    motion: parsed.motion,
  };
}

function mergeTokenGroups(base: DesignMdTokenGroups, override: DesignMdTokenGroups): DesignMdTokenGroups {
  return {
    colors: { ...base.colors, ...override.colors },
    typography: mergeNestedStringRecords(base.typography, override.typography),
    rounded: { ...base.rounded, ...override.rounded },
    spacing: { ...base.spacing, ...override.spacing },
    shadows: { ...base.shadows, ...override.shadows },
    motion: { ...base.motion, ...override.motion },
  };
}

function mergeNestedStringRecords(
  base: Record<string, Record<string, string>>,
  override: Record<string, Record<string, string>>,
): Record<string, Record<string, string>> {
  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] = { ...(merged[key] ?? {}), ...value };
  }
  return merged;
}

function buildTokenReferenceIndex(tokens: DesignMdTokenGroups, diagnostics: string[]): TokenReferenceIndex {
  const entries: TokenReferenceEntry[] = [];
  const add = (reference: string, variable: string, value: string) => {
    if (!isSafeCssValue(value)) {
      diagnostics.push(`Skipped unsafe value for ${reference}.`);
      return;
    }
    entries.push({ reference, variable, value });
  };

  for (const [key, value] of Object.entries(tokens.colors)) {
    add(`colors.${key}`, `--design-color-${cssName(key)}`, value);
  }
  for (const [key, typography] of Object.entries(tokens.typography)) {
    for (const [property, value] of Object.entries(typography)) {
      add(`typography.${key}.${property}`, `--design-${cssName(property)}-${cssName(key)}`, value);
    }
  }
  for (const [key, value] of Object.entries(tokens.rounded)) {
    add(`rounded.${key}`, `--design-radius-${cssName(key)}`, value);
  }
  for (const [key, value] of Object.entries(tokens.spacing)) {
    add(`spacing.${key}`, `--design-space-${cssName(key)}`, value);
  }
  for (const [key, value] of Object.entries(tokens.shadows)) {
    add(`shadows.${key}`, `--design-shadow-${cssName(key)}`, value);
  }
  for (const [key, value] of Object.entries(tokens.motion)) {
    add(`motion.${key}`, `--design-motion-${cssName(key)}`, value);
  }

  return {
    entries,
    byReference: new Map(entries.map((entry) => [entry.reference, entry])),
  };
}

function renderStyleDeclarations(
  styles: Record<string, string>,
  path: string,
  tokenReferences: TokenReferenceIndex,
  diagnostics: string[],
  asCustomProperties: boolean,
): StyleDeclarationRender {
  const cssLines: string[] = [];
  const variables: Record<string, string> = {};

  for (const [name, rawValue] of Object.entries(styles)) {
    const declaration = resolveStyleDeclaration(`${path}.${name}`, rawValue, tokenReferences, diagnostics);
    if (!declaration) continue;
    const propertyName = asCustomProperties ? cssCustomPropertyName(name) : cssName(name);
    cssLines.push(`  ${propertyName}: ${declaration.cssValue};`);
    if (asCustomProperties) {
      variables[propertyName] = declaration.value;
    }
  }

  return { cssLines, variables };
}

function renderWidgetBlocks(
  widgets: Record<string, Record<string, string>>,
  tokenReferences: TokenReferenceIndex,
  diagnostics: string[],
): string[] {
  return Object.entries(widgets).flatMap(([widgetId, styles]) => {
    const rendered = renderStyleDeclarations(styles, `styles.widgets.${widgetId}`, tokenReferences, diagnostics, false);
    if (!rendered.cssLines.length) return [];
    return [
      `[data-design-widget="${cssName(widgetId)}"] {`,
      ...rendered.cssLines,
      '}',
    ];
  });
}

function resolveStyleDeclaration(
  path: string,
  rawValue: string,
  tokenReferences: TokenReferenceIndex,
  diagnostics: string[],
): { cssValue: string; value: string } | null {
  const value = rawValue.trim();
  if (isDesignTokenReference(value)) {
    const token = tokenReferences.byReference.get(value);
    if (!token) {
      diagnostics.push(`Missing token reference ${value} for ${path}.`);
      return null;
    }
    return { cssValue: `var(${token.variable})`, value: token.value };
  }
  if (!isSafeCssValue(value)) {
    diagnostics.push(`Skipped unsafe value for ${path}.`);
    return null;
  }
  return { cssValue: value, value };
}

function isDesignTokenReference(value: string): boolean {
  const group = /^([A-Za-z][A-Za-z0-9_-]*)\./.exec(value)?.[1];
  return Boolean(group && DESIGN_TOKEN_REFERENCE_GROUPS.has(group));
}

function parseThemeRecords(source: Record<string, unknown>): Record<string, DesignMdTokenGroups> {
  const value = source.themes;
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
    .map(([themeId, theme]) => [themeId, {
      colors: nestedStringRecord(theme, 'colors'),
      typography: doubleNestedStringRecord(theme, 'typography'),
      rounded: nestedStringRecord(theme, 'rounded'),
      spacing: nestedStringRecord(theme, 'spacing'),
      shadows: nestedStringRecord(theme, 'shadows'),
      motion: nestedStringRecord(theme, 'motion'),
    }]));
}

function parseStyleRecords(source: Record<string, unknown>): DesignMdStyles {
  const value = source.styles;
  if (!isRecord(value)) return { agentBrowser: {}, widgets: {} };
  return {
    agentBrowser: nestedStringRecord(value, 'agentBrowser'),
    widgets: doubleNestedStringRecord(value, 'widgets'),
  };
}

function cssCustomPropertyName(value: string): string {
  return `--${cssName(value.replace(/^--/, ''))}`;
}

function cssName(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'token';
}

function isSafeCssValue(value: string): boolean {
  return !/[;{}<>]/.test(value);
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
