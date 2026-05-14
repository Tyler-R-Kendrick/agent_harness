export type RuntimePluginEventKind =
  | 'session:start'
  | 'permission:request'
  | 'message:received'
  | 'tool:before-call'
  | 'tool:after-call'
  | 'file:changed'
  | 'diagnostic:reported';

export type RuntimePluginInterceptionMode = 'observe' | 'rewrite' | 'block';
export type RuntimePluginSource = 'repo' | 'user' | 'workspace';
export type RuntimePluginProviderKind = 'model' | 'auth' | 'tooling';
export type RuntimePluginToolDecision = 'allow' | 'rewrite' | 'block';

export interface RuntimePluginSettings {
  enabled: boolean;
  defaultInterceptionMode: RuntimePluginInterceptionMode;
  requireRationale: boolean;
  enabledPluginIds: string[];
  blockedToolIds: string[];
  rewriteRules: string[];
}

export interface RuntimePluginToolRegistration {
  id: string;
  name: string;
  description: string;
}

export interface RuntimePluginProviderRegistration {
  id: string;
  name: string;
  kind: RuntimePluginProviderKind;
}

export interface RuntimePluginManifest {
  id: string;
  name: string;
  description: string;
  source: RuntimePluginSource;
  tools: RuntimePluginToolRegistration[];
  providers: RuntimePluginProviderRegistration[];
  eventSubscriptions: RuntimePluginEventKind[];
  interceptsToolCalls: boolean;
  shellEnvironment: Record<string, string>;
  compactionHint?: string;
}

export interface RuntimePluginRuntime {
  enabled: boolean;
  settings: RuntimePluginSettings;
  manifests: RuntimePluginManifest[];
  activePlugins: RuntimePluginManifest[];
  manifestCount: number;
  activePluginCount: number;
  selectedToolIds: string[];
  toolRegistrations: RuntimePluginToolRegistration[];
  providerRegistrations: RuntimePluginProviderRegistration[];
  eventSubscriptions: Partial<Record<RuntimePluginEventKind, string[]>>;
  shellEnvironment: Record<string, string>;
  compactionHints: string[];
  policySummary: string[];
  routingExtensions: RuntimeRoutingExtension[];
}

export interface RuntimeRoutingExtensionOutput {
  featureSignals?: Record<string, number>;
  thresholdAdjustments?: Partial<Record<'minConfidence' | 'complexityThreshold', number>>;
  objectiveAdjustments?: Partial<Record<'quality' | 'cost' | 'latency' | 'balanced', number>>;
  alternateScoringModuleId?: string;
  enforceEscalationInvariant?: boolean;
  enforceConfidenceFallbackInvariant?: boolean;
}

export interface RuntimeRoutingExtension {
  pluginId: string;
  provideRoutingOutput: () => RuntimeRoutingExtensionOutput;
}

export interface RuntimePluginToolCall {
  id: string;
  toolId: string;
  args: Record<string, unknown>;
}

export interface RuntimePluginAuditEntry {
  callId: string;
  pluginId: string;
  decision: Exclude<RuntimePluginToolDecision, 'allow'>;
  rationale: string;
  originalToolId: string;
  originalArgs: Record<string, unknown>;
  rewrittenArgs?: Record<string, unknown>;
}

export interface RuntimePluginToolCallDecision {
  decision: RuntimePluginToolDecision;
  rationale: string;
  rewrittenArgs?: Record<string, unknown>;
  auditEntry?: RuntimePluginAuditEntry;
}

export const DEFAULT_RUNTIME_PLUGIN_SETTINGS: RuntimePluginSettings = {
  enabled: true,
  defaultInterceptionMode: 'observe',
  requireRationale: true,
  enabledPluginIds: ['repo-policy'],
  blockedToolIds: [],
  rewriteRules: [],
};

export const DEFAULT_RUNTIME_PLUGIN_MANIFESTS: RuntimePluginManifest[] = [{
  id: 'repo-policy',
  name: 'Repo policy',
  description: 'Registers repository-safe tool-call policy hooks and audit events.',
  source: 'repo',
  tools: [{
    id: 'runtime.policy.review',
    name: 'Runtime policy review',
    description: 'Review pending tool calls against active runtime plugin policy.',
  }],
  providers: [{
    id: 'runtime-policy-provider',
    name: 'Runtime Policy Provider',
    kind: 'auth',
  }],
  eventSubscriptions: ['session:start', 'tool:before-call', 'tool:after-call', 'diagnostic:reported'],
  interceptsToolCalls: true,
  shellEnvironment: { AGENT_BROWSER_RUNTIME_PLUGINS: 'enabled' },
  compactionHint: 'Preserve runtime plugin audit ids, blocked tool calls, and rewritten arguments.',
}];

const EVENT_KINDS = new Set<RuntimePluginEventKind>([
  'session:start',
  'permission:request',
  'message:received',
  'tool:before-call',
  'tool:after-call',
  'file:changed',
  'diagnostic:reported',
]);

const INTERCEPTION_MODES = new Set<RuntimePluginInterceptionMode>(['observe', 'rewrite', 'block']);
const PROVIDER_KINDS = new Set<RuntimePluginProviderKind>(['model', 'auth', 'tooling']);

export function isRuntimePluginSettings(value: unknown): value is RuntimePluginSettings {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean'
    && INTERCEPTION_MODES.has(value.defaultInterceptionMode as RuntimePluginInterceptionMode)
    && typeof value.requireRationale === 'boolean'
    && isStringArray(value.enabledPluginIds)
    && isStringArray(value.blockedToolIds)
    && isStringArray(value.rewriteRules)
  );
}

export function normalizeRuntimePluginSettings(
  settings: RuntimePluginSettings = DEFAULT_RUNTIME_PLUGIN_SETTINGS,
): RuntimePluginSettings {
  return {
    enabled: settings.enabled,
    defaultInterceptionMode: settings.defaultInterceptionMode,
    requireRationale: settings.requireRationale,
    enabledPluginIds: uniqueStrings(settings.enabledPluginIds),
    blockedToolIds: uniqueStrings(settings.blockedToolIds),
    rewriteRules: uniqueStrings(settings.rewriteRules),
  };
}

export function isRuntimePluginManifest(value: unknown): value is RuntimePluginManifest {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.description === 'string'
    && (value.source === 'repo' || value.source === 'user' || value.source === 'workspace')
    && Array.isArray(value.tools)
    && value.tools.every(isToolRegistration)
    && Array.isArray(value.providers)
    && value.providers.every(isProviderRegistration)
    && Array.isArray(value.eventSubscriptions)
    && value.eventSubscriptions.every((event) => EVENT_KINDS.has(event as RuntimePluginEventKind))
    && typeof value.interceptsToolCalls === 'boolean'
    && isStringRecord(value.shellEnvironment)
    && (value.compactionHint === undefined || typeof value.compactionHint === 'string')
  );
}

export function buildRuntimePluginRuntime({
  settings = DEFAULT_RUNTIME_PLUGIN_SETTINGS,
  manifests = DEFAULT_RUNTIME_PLUGIN_MANIFESTS,
  selectedToolIds = [],
}: {
  settings?: RuntimePluginSettings;
  manifests?: RuntimePluginManifest[];
  selectedToolIds?: string[];
}): RuntimePluginRuntime {
  const normalizedSettings = normalizeRuntimePluginSettings(settings);
  const validManifests = manifests.filter(isRuntimePluginManifest).map(cloneManifest);
  const selectedTools = uniqueStrings(selectedToolIds);
  const enabledIds = new Set(normalizedSettings.enabledPluginIds);
  const activePlugins = normalizedSettings.enabled
    ? validManifests.filter((manifest) => enabledIds.has(manifest.id))
    : [];
  const eventSubscriptions: Partial<Record<RuntimePluginEventKind, string[]>> = {};
  const shellEnvironment: Record<string, string> = {};

  for (const plugin of activePlugins) {
    for (const event of plugin.eventSubscriptions) {
      eventSubscriptions[event] = [...(eventSubscriptions[event] ?? []), plugin.id];
    }
    Object.assign(shellEnvironment, plugin.shellEnvironment);
  }

  const toolRegistrations = activePlugins.flatMap((plugin) => plugin.tools.map((tool) => ({ ...tool })));
  const providerRegistrations = activePlugins.flatMap((plugin) => plugin.providers.map((provider) => ({ ...provider })));
  const compactionHints = activePlugins
    .map((plugin) => plugin.compactionHint?.trim())
    .filter((hint): hint is string => Boolean(hint));
  const policySummary = activePlugins.map((plugin) => {
    const events = plugin.eventSubscriptions.length > 0 ? plugin.eventSubscriptions.join(', ') : 'no events';
    return `${plugin.name}: ${plugin.interceptsToolCalls ? 'intercepts tool calls' : 'observes'}; events ${events}.`;
  });
  const routingExtensions = activePlugins.map((plugin): RuntimeRoutingExtension => ({
    pluginId: plugin.id,
    provideRoutingOutput: () => ({
      featureSignals: {},
      thresholdAdjustments: {},
      objectiveAdjustments: {},
      enforceEscalationInvariant: true,
      enforceConfidenceFallbackInvariant: true,
    }),
  }));

  return {
    enabled: normalizedSettings.enabled,
    settings: normalizedSettings,
    manifests: validManifests,
    activePlugins,
    manifestCount: validManifests.length,
    activePluginCount: activePlugins.length,
    selectedToolIds: selectedTools,
    toolRegistrations,
    providerRegistrations,
    eventSubscriptions,
    shellEnvironment,
    compactionHints,
    policySummary,
    routingExtensions,
  };
}

export function resolveRuntimeRoutingExtensionOutputs(runtime: RuntimePluginRuntime): RuntimeRoutingExtensionOutput[] {
  return runtime.routingExtensions.map((extension) => enforceCoreRoutingSafetyInvariants(extension.provideRoutingOutput()));
}

export function enforceCoreRoutingSafetyInvariants(output: RuntimeRoutingExtensionOutput): RuntimeRoutingExtensionOutput {
  return {
    ...output,
    enforceEscalationInvariant: true,
    enforceConfidenceFallbackInvariant: true,
  };
}

export function buildRuntimePluginPromptContext(runtime: RuntimePluginRuntime): string {
  if (!runtime.enabled || runtime.activePluginCount === 0) return '';
  const lines = [
    '## Runtime Plugin Policy',
    'Runtime plugin policy: enabled',
    `Active plugins: ${runtime.activePluginCount}/${runtime.manifestCount}`,
    `Tool-call interception mode: ${runtime.settings.defaultInterceptionMode}`,
    `Rationale required: ${runtime.settings.requireRationale ? 'yes' : 'no'}`,
  ];
  const activePlugins = runtime.manifests.filter((manifest) => runtime.settings.enabledPluginIds.includes(manifest.id));
  if (activePlugins.length > 0) {
    lines.push(`Plugin manifests: ${activePlugins.map((plugin) => `${plugin.name} (${plugin.id})`).join(', ')}`);
  }
  if (runtime.toolRegistrations.length > 0) {
    lines.push(`Registered plugin tools: ${runtime.toolRegistrations.map((tool) => `${tool.id} (${tool.name})`).join(', ')}`);
  }
  if (runtime.providerRegistrations.length > 0) {
    lines.push(`Registered providers: ${runtime.providerRegistrations.map((provider) => `${provider.id} (${provider.kind})`).join(', ')}`);
  }
  const events = Object.entries(runtime.eventSubscriptions)
    .map(([event, pluginIds]) => `${event}: ${(pluginIds ?? []).join(', ')}`);
  if (events.length > 0) {
    lines.push('Event subscriptions:');
    lines.push(...events.map((event) => `- ${event}`));
  }
  const envKeys = Object.keys(runtime.shellEnvironment);
  if (envKeys.length > 0) {
    lines.push(`Shell environment from plugins: ${envKeys.join(', ')}`);
  }
  if (runtime.compactionHints.length > 0) {
    lines.push('Compaction hints:');
    lines.push(...runtime.compactionHints.map((hint) => `- ${hint}`));
  }
  if (runtime.settings.blockedToolIds.length > 0) {
    lines.push(`Blocked tools: ${runtime.settings.blockedToolIds.join(', ')}`);
  }
  return lines.join('\n');
}

export function evaluateRuntimePluginToolCall({
  runtime,
  toolCall,
}: {
  runtime: RuntimePluginRuntime;
  toolCall: RuntimePluginToolCall;
}): RuntimePluginToolCallDecision {
  if (!runtime.enabled || runtime.activePluginCount === 0) {
    return { decision: 'allow', rationale: 'Runtime plugin policy is disabled.' };
  }

  const interceptingPlugin = runtime.activePlugins.find((plugin) => plugin.interceptsToolCalls) ?? runtime.activePlugins[0];
  const blockedToolIds = new Set(runtime.settings.blockedToolIds);
  if (blockedToolIds.has(toolCall.toolId) || runtime.settings.defaultInterceptionMode === 'block') {
    const rationale = `Runtime plugin policy blocked ${toolCall.toolId}.`;
    return {
      decision: 'block',
      rationale,
      auditEntry: createAuditEntry({
        call: toolCall,
        pluginId: interceptingPlugin.id,
        decision: 'block',
        rationale,
      }),
    };
  }

  const rewrittenArgs = applyRewriteRules(toolCall.toolId, toolCall.args, runtime.settings.rewriteRules);
  if (rewrittenArgs && runtime.settings.defaultInterceptionMode === 'rewrite') {
    const rationale = `Runtime plugin policy rewrote arguments for ${toolCall.toolId}.`;
    return {
      decision: 'rewrite',
      rationale,
      rewrittenArgs,
      auditEntry: createAuditEntry({
        call: toolCall,
        pluginId: interceptingPlugin.id,
        decision: 'rewrite',
        rationale,
        rewrittenArgs,
      }),
    };
  }

  return {
    decision: 'allow',
    rationale: 'No active runtime plugin policy matched this tool call.',
  };
}

function applyRewriteRules(
  toolId: string,
  args: Record<string, unknown>,
  rewriteRules: readonly string[],
): Record<string, unknown> | null {
  const updates: Record<string, string> = {};
  for (const rule of rewriteRules) {
    const match = /^([^:]+):([^=]+)=(.*)$/.exec(rule);
    if (!match) continue;
    const [, ruleToolId, key, value] = match;
    if (ruleToolId.trim() !== toolId) continue;
    updates[key.trim()] = value.trim();
  }
  return Object.keys(updates).length > 0 ? { ...args, ...updates } : null;
}

function createAuditEntry({
  call,
  pluginId,
  decision,
  rationale,
  rewrittenArgs,
}: {
  call: RuntimePluginToolCall;
  pluginId: string;
  decision: Exclude<RuntimePluginToolDecision, 'allow'>;
  rationale: string;
  rewrittenArgs?: Record<string, unknown>;
}): RuntimePluginAuditEntry {
  return {
    callId: call.id,
    pluginId,
    decision,
    rationale,
    originalToolId: call.toolId,
    originalArgs: { ...call.args },
    ...(rewrittenArgs ? { rewrittenArgs: { ...rewrittenArgs } } : {}),
  };
}

function cloneManifest(manifest: RuntimePluginManifest): RuntimePluginManifest {
  return {
    ...manifest,
    tools: manifest.tools.map((tool) => ({ ...tool })),
    providers: manifest.providers.map((provider) => ({ ...provider })),
    eventSubscriptions: [...manifest.eventSubscriptions],
    shellEnvironment: { ...manifest.shellEnvironment },
  };
}

function isToolRegistration(value: unknown): value is RuntimePluginToolRegistration {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.description === 'string';
}

function isProviderRegistration(value: unknown): value is RuntimePluginProviderRegistration {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && PROVIDER_KINDS.has(value.kind as RuntimePluginProviderKind);
}

function uniqueStrings(values: readonly string[]): string[] {
  return values.map((value) => value.trim()).filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
