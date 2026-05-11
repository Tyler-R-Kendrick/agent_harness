import {
  createHarnessExtensionContext,
  parseHarnessPluginManifest,
  parseHarnessPluginMarketplaceManifest,
  type Command,
  type HarnessHook,
  type HarnessPlugin,
  type HarnessPluginManifest,
  type HarnessPluginMarketplaceManifest,
  type HarnessRendererDefinition,
  type HarnessToolDefinition,
  type InferenceMessagesPayload,
  type MemoryMessage,
  type WorkspaceFile,
} from 'harness-core';
import { createAgentSkillsPlugin } from '@agent-harness/ext-agent-skills';
import { createAgentsMdHookPlugin } from '@agent-harness/ext-agents-md';
import { createArtifactsPlugin } from '@agent-harness/ext-artifacts';
import { createDesignMdPlugin } from '@agent-harness/ext-design-md';
import { createSymphonyPlugin } from '@agent-harness/ext-symphony';
import { createLocalModelConnectorPlugin } from '@agent-harness/ext-local-model-connector';
import { createWorkflowCanvasPlugin } from '@agent-harness/ext-workflow-canvas';

import marketplaceManifestSource from '../../../ext/agent-harness.marketplace.json';
import { createGhcpModelProviderPlugin } from '../../../ext/ghcp-model-provider/src/index.ts';
import ghcpModelProviderManifestSource from '../../../ext/ghcp-model-provider/agent-harness.plugin.json';
import { createCursorModelProviderPlugin } from '../../../ext/cursor-model-provider/src/index.ts';
import cursorModelProviderManifestSource from '../../../ext/cursor-model-provider/agent-harness.plugin.json';
import { createCodexModelProviderPlugin } from '../../../ext/codex-model-provider/src/index.ts';
import codexModelProviderManifestSource from '../../../ext/codex-model-provider/agent-harness.plugin.json';
import { createCodiBrowserModelProviderPlugin } from '../../../ext/codi-browser-model-provider/src/index.ts';
import huggingFaceModelProviderManifestSource from '../../../ext/codi-browser-model-provider/agent-harness.plugin.json';
import localInferenceWorkerManifestSource from '../../../ext/worker/local-inference-worker/agent-harness.plugin.json';
import agentSkillsManifestSource from '../../../ext/harness/agent-skills/agent-harness.plugin.json';
import agentsMdManifestSource from '../../../ext/harness/agents-md/agent-harness.plugin.json';
import artifactsContextManifestSource from '../../../ext/harness/artifacts/agent-harness.plugin.json';
import artifactsWorktreeManifestSource from '../../../ext/ide/artifacts-worktree/agent-harness.plugin.json';
import designMdContextManifestSource from '../../../ext/harness/design-md/agent-harness.plugin.json';
import openDesignManifestSource from '../../../ext/ide/open-design/agent-harness.plugin.json';
import workflowCanvasManifestSource from '../../../ext/ide/workflow-canvas/agent-harness.plugin.json';
import localModelConnectorManifestSource from '../../../ext/provider/local-model-connector/agent-harness.plugin.json';
import openAiModelProviderManifestSource from '../../../ext/provider/openai-model-provider/agent-harness.plugin.json';
import azureInferenceModelProviderManifestSource from '../../../ext/provider/azure-inference-model-provider/agent-harness.plugin.json';
import awsBedrockModelProviderManifestSource from '../../../ext/provider/aws-bedrock-model-provider/agent-harness.plugin.json';
import anthropicModelProviderManifestSource from '../../../ext/provider/anthropic-model-provider/agent-harness.plugin.json';
import xaiModelProviderManifestSource from '../../../ext/provider/xai-model-provider/agent-harness.plugin.json';
import symphonyManifestSource from '../../../ext/runtime/symphony/agent-harness.plugin.json';

export interface DefaultExtensionDescriptor {
  marketplace: HarnessPluginMarketplaceManifest['plugins'][number];
  manifest: HarnessPluginManifest;
}

export interface DefaultExtensionSummary {
  pluginCount: number;
  hookCount: number;
  toolCount: number;
  commandCount: number;
  rendererCount: number;
}

export interface DefaultExtensionDependencyPlan {
  extensionIds: string[];
  missingDependencyIds: string[];
  cyclicDependencyIds: string[];
}

export interface DefaultExtensionRuntime {
  extensions: DefaultExtensionDescriptor[];
  installedExtensionIds: string[];
  plugins: HarnessPlugin[];
  hooks: HarnessHook<InferenceMessagesPayload<MemoryMessage>>[];
  tools: HarnessToolDefinition[];
  commands: Command[];
  renderers: HarnessRendererDefinition[];
}

export interface CreateDefaultExtensionRuntimeOptions {
  installedExtensionIds?: readonly string[];
}

export type ExtensionMarketplaceCategory = 'ide' | 'harness' | 'worker' | 'provider';

export type DefaultExtensionAvailability =
  | { state: 'available' }
  | { state: 'unavailable'; reason: string };

export type DefaultExtensionOpenFeatureFlags = Record<string, boolean>;

export const EXTENSION_MARKETPLACE_CATEGORIES: ExtensionMarketplaceCategory[] = [
  'ide',
  'harness',
  'worker',
  'provider',
];

export const EXTENSION_MARKETPLACE_CATEGORY_LABELS: Record<ExtensionMarketplaceCategory, string> = {
  ide: 'IDE extensions',
  harness: 'Harness extensions',
  worker: 'Worker extensions',
  provider: 'Provider extensions',
};

export const DEFAULT_EXTENSION_MARKETPLACE = parseHarnessPluginMarketplaceManifest(marketplaceManifestSource);
export const DEFAULT_EXTENSION_MARKETPLACES: HarnessPluginMarketplaceManifest[] = [DEFAULT_EXTENSION_MARKETPLACE];

const DEFAULT_MANIFESTS_BY_ID = new Map([
  ['agent-harness.ext.agent-skills', parseHarnessPluginManifest(agentSkillsManifestSource)],
  ['agent-harness.ext.agents-md', parseHarnessPluginManifest(agentsMdManifestSource)],
  ['agent-harness.ext.design-md-context', parseHarnessPluginManifest(designMdContextManifestSource)],
  ['agent-harness.ext.open-design', parseHarnessPluginManifest(openDesignManifestSource)],
  ['agent-harness.ext.symphony', parseHarnessPluginManifest(symphonyManifestSource)],
  ['agent-harness.ext.workflow-canvas', parseHarnessPluginManifest(workflowCanvasManifestSource)],
  ['agent-harness.ext.artifacts-context', parseHarnessPluginManifest(artifactsContextManifestSource)],
  ['agent-harness.ext.artifacts-worktree', parseHarnessPluginManifest(artifactsWorktreeManifestSource)],
  ['agent-harness.ext.huggingface-model-provider', parseHarnessPluginManifest(huggingFaceModelProviderManifestSource)],
  ['agent-harness.ext.ghcp-model-provider', parseHarnessPluginManifest(ghcpModelProviderManifestSource)],
  ['agent-harness.ext.cursor-model-provider', parseHarnessPluginManifest(cursorModelProviderManifestSource)],
  ['agent-harness.ext.codex-model-provider', parseHarnessPluginManifest(codexModelProviderManifestSource)],
  ['agent-harness.ext.openai-model-provider', parseHarnessPluginManifest(openAiModelProviderManifestSource)],
  ['agent-harness.ext.azure-inference-model-provider', parseHarnessPluginManifest(azureInferenceModelProviderManifestSource)],
  ['agent-harness.ext.aws-bedrock-model-provider', parseHarnessPluginManifest(awsBedrockModelProviderManifestSource)],
  ['agent-harness.ext.anthropic-model-provider', parseHarnessPluginManifest(anthropicModelProviderManifestSource)],
  ['agent-harness.ext.xai-model-provider', parseHarnessPluginManifest(xaiModelProviderManifestSource)],
  ['agent-harness.ext.local-model-connector', parseHarnessPluginManifest(localModelConnectorManifestSource)],
  ['agent-harness.ext.local-inference-daemon', parseHarnessPluginManifest(localInferenceWorkerManifestSource)],
]);

export const DEFAULT_EXTENSION_MANIFESTS: DefaultExtensionDescriptor[] = DEFAULT_EXTENSION_MARKETPLACE.plugins.map((marketplace) => {
  const manifest = DEFAULT_MANIFESTS_BY_ID.get(marketplace.id);
  if (!manifest) {
    throw new Error(`Missing default extension manifest: ${marketplace.id}`);
  }
  return { marketplace, manifest };
});

const DEFAULT_EXTENSION_IDS = new Set(DEFAULT_EXTENSION_MANIFESTS.map((extension) => extension.manifest.id));

const DEFAULT_EXTENSION_ID_ALIASES = new Map<string, readonly string[]>([
  ['agent-harness.ext.design-md', ['agent-harness.ext.design-md-context', 'agent-harness.ext.open-design']],
  ['agent-harness.ext.artifacts', ['agent-harness.ext.artifacts-context', 'agent-harness.ext.artifacts-worktree']],
  ['agent-harness.ext.codi-browser-model-provider', ['agent-harness.ext.huggingface-model-provider']],
]);

const EMPTY_EXTENSION_SUMMARY: DefaultExtensionSummary = Object.freeze({
  pluginCount: 0,
  hookCount: 0,
  toolCount: 0,
  commandCount: 0,
  rendererCount: 0,
});

export async function createDefaultExtensionRuntime(
  workspaceFiles: readonly WorkspaceFile[],
  options: CreateDefaultExtensionRuntimeOptions = {},
): Promise<DefaultExtensionRuntime> {
  const context = createHarnessExtensionContext<MemoryMessage, InferenceMessagesPayload<MemoryMessage>>();
  const installedExtensionIds = selectInstalledDefaultExtensionIds(options.installedExtensionIds ?? []);
  const designDocuments = workspaceFiles
    .filter((file) => file.path === 'DESIGN.md' || file.path.endsWith('/Design.md') || file.path.endsWith('/DESIGN.md'))
    .map((file) => ({ path: file.path, content: file.content }));

  const pluginFactories = new Map<string, () => HarnessPlugin>([
    ['agent-harness.ext.agent-skills', () => createAgentSkillsPlugin(workspaceFiles, {
      client: {
        executeSkill({ skill }) {
          throw new Error(`Agent skill "${skill.name}" cannot run until a session skill runner is connected.`);
        },
      },
    })],
    ['agent-harness.ext.agents-md', () => createAgentsMdHookPlugin(workspaceFiles)],
    ['agent-harness.ext.design-md-context', () => createDesignMdPlugin({ documents: designDocuments })],
    ['agent-harness.ext.symphony', () => createSymphonyPlugin(workspaceFiles)],
    ['agent-harness.ext.workflow-canvas', () => createWorkflowCanvasPlugin()],
    ['agent-harness.ext.artifacts-context', () => createArtifactsPlugin()],
    ['agent-harness.ext.local-model-connector', () => createLocalModelConnectorPlugin()],
    ['agent-harness.ext.ghcp-model-provider', () => createGhcpModelProviderPlugin()],
    ['agent-harness.ext.cursor-model-provider', () => createCursorModelProviderPlugin()],
    ['agent-harness.ext.codex-model-provider', () => createCodexModelProviderPlugin()],
    ['agent-harness.ext.huggingface-model-provider', () => createCodiBrowserModelProviderPlugin()],
  ]);

  await context.plugins.loadAll(installedExtensionIds.map((extensionId) => pluginFactories.get(extensionId)?.()).filter(isHarnessPlugin));
  const installedManifestRenderers = DEFAULT_EXTENSION_MANIFESTS
    .filter((extension) => installedExtensionIds.includes(extension.manifest.id))
    .flatMap((extension) => extension.manifest.renderers ?? []);
  const renderers = dedupeRenderers([
    ...installedManifestRenderers,
    ...context.renderers.list(),
  ]);

  return {
    extensions: DEFAULT_EXTENSION_MANIFESTS,
    installedExtensionIds,
    plugins: context.plugins.list(),
    hooks: context.hooks.list(),
    tools: context.tools.list(),
    commands: context.commands.list(),
    renderers,
  };
}

export function summarizeDefaultExtensionRuntime(runtime: DefaultExtensionRuntime | null): DefaultExtensionSummary {
  if (!runtime) return EMPTY_EXTENSION_SUMMARY;
  return {
    pluginCount: runtime.plugins.length,
    hookCount: runtime.hooks.length,
    toolCount: runtime.tools.length,
    commandCount: runtime.commands.length,
    rendererCount: runtime.renderers.length,
  };
}

export function getExtensionMarketplaceCategory(extension: DefaultExtensionDescriptor): ExtensionMarketplaceCategory {
  const metadataCategory = extension.marketplace.metadata?.marketplaceCategory;
  if (isExtensionMarketplaceCategory(metadataCategory)) return metadataCategory;
  if (metadataCategory === 'daemon' || metadataCategory === 'runtime') return 'worker';

  for (const category of extension.marketplace.categories ?? []) {
    const normalized = category.replace(/-extension$/, '');
    if (normalized === 'daemon' || normalized === 'runtime') return 'worker';
    if (isExtensionMarketplaceCategory(normalized)) return normalized;
  }

  if (extension.manifest.capabilities?.some((capability) => capability.kind === 'model-provider')) return 'provider';
  if (extension.manifest.assets?.some((asset) => asset.kind === 'runtime')) return 'worker';
  if (extension.manifest.renderers?.length || extension.manifest.paneItems?.length || extension.manifest.capabilities?.some((capability) => capability.kind === 'renderer' || capability.kind === 'pane-item')) return 'ide';
  return 'harness';
}

export function isDefaultExtensionActivityFeature(extension: DefaultExtensionDescriptor): boolean {
  const marketplaceCategories = extension.marketplace.categories ?? [];
  const installSurface = extension.marketplace.metadata?.installSurface ?? extension.manifest.metadata?.installSurface;
  const workspaceItemOnlyRenderer = Boolean(extension.manifest.renderers?.length)
    && (extension.manifest.renderers ?? []).every((renderer) => renderer.target.kind === 'workspace-item')
    && !(extension.manifest.paneItems?.length);
  const workspaceTreeOnly = marketplaceCategories.includes('workspace-tree')
    || installSurface === 'workspace-tree'
    || workspaceItemOnlyRenderer;
  return getExtensionMarketplaceCategory(extension) === 'ide' && !workspaceTreeOnly;
}

export function groupDefaultExtensionsByMarketplaceCategory(
  extensions: readonly DefaultExtensionDescriptor[],
): Record<ExtensionMarketplaceCategory, DefaultExtensionDescriptor[]> {
  const groups: Record<ExtensionMarketplaceCategory, DefaultExtensionDescriptor[]> = {
    ide: [],
    harness: [],
    worker: [],
    provider: [],
  };

  for (const extension of extensions) {
    groups[getExtensionMarketplaceCategory(extension)].push(extension);
  }

  return groups;
}

export function getInstalledDefaultExtensionDescriptors(
  runtime: DefaultExtensionRuntime | null,
  fallbackInstalledExtensionIds: readonly string[] = [],
): DefaultExtensionDescriptor[] {
  const installedIds = new Set(normalizeDefaultExtensionIds(
    fallbackInstalledExtensionIds.length ? fallbackInstalledExtensionIds : runtime?.installedExtensionIds ?? [],
  ));
  const extensions = runtime?.extensions ?? DEFAULT_EXTENSION_MANIFESTS;
  return extensions.filter((extension) => installedIds.has(extension.manifest.id));
}

export function buildRuntimeExtensionPromptContext(runtime: DefaultExtensionRuntime | null): string | null {
  const runtimeExtensions = getInstalledDefaultExtensionDescriptors(runtime)
    .filter(hasRuntimeEvents);
  if (!runtimeExtensions.length) return null;

  const lines = runtimeExtensions.map((extension) => {
    const eventNames = extension.manifest.events?.map((event) => `${event.type}:${event.name}`) ?? [];
    const eventSummary = eventNames.length ? ` events ${eventNames.join(', ')}` : ' runtime hooks active';
    return `- ${extension.manifest.name}: ${extension.manifest.description};${eventSummary}`;
  });

  return ['Runtime extensions integrated into this inference loop:', ...lines].join('\n');
}

export function normalizeDefaultExtensionIds(extensionIds: readonly string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const extensionId of extensionIds) {
    const candidates = DEFAULT_EXTENSION_ID_ALIASES.get(extensionId) ?? [extensionId];
    for (const candidate of candidates) {
      if (!DEFAULT_EXTENSION_IDS.has(candidate) || seen.has(candidate)) continue;
      seen.add(candidate);
      normalized.push(candidate);
    }
  }

  return normalized;
}

export function getDefaultExtensionOpenFeatureFlagKey(extensionId: string): string {
  return `agent-harness.extensions.${extensionId}.enabled`;
}

export function resolveEnabledDefaultExtensionIds(
  installedExtensionIds: readonly string[],
  flags: DefaultExtensionOpenFeatureFlags,
): string[] {
  return resolveDefaultExtensionDependencyPlan(installedExtensionIds).extensionIds
    .filter((extensionId) => flags[getDefaultExtensionOpenFeatureFlagKey(extensionId)] !== false);
}

export function getDefaultExtensionAvailability(extension: DefaultExtensionDescriptor): DefaultExtensionAvailability {
  const metadata = readRecord(extension.marketplace.metadata?.availability)
    ?? readRecord(extension.manifest.metadata?.availability);
  if (!metadata) return { state: 'available' };

  if (metadata.state === 'unavailable') {
    return {
      state: 'unavailable',
      reason: typeof metadata.reason === 'string'
        ? metadata.reason
        : 'This extension is not available in the current runtime.',
    };
  }

  return { state: 'available' };
}

function selectInstalledDefaultExtensionIds(installedExtensionIds: readonly string[]): string[] {
  return resolveDefaultExtensionDependencyPlan(installedExtensionIds).extensionIds;
}

export function getDefaultExtensionDependencyIds(extension: DefaultExtensionDescriptor): string[] {
  const dependencyIds = [
    ...readStringArray(extension.manifest.metadata?.dependencies),
    ...readStringArray(extension.marketplace.metadata?.dependencies),
  ];
  const selfId = extension.manifest.id;
  return normalizeDefaultExtensionIds(dependencyIds)
    .filter((dependencyId) => dependencyId !== selfId);
}

export function resolveDefaultExtensionDependencyPlan(
  extensionIds: readonly string[],
  extensions: readonly DefaultExtensionDescriptor[] = DEFAULT_EXTENSION_MANIFESTS,
): DefaultExtensionDependencyPlan {
  const byId = new Map(extensions.map((extension) => [extension.manifest.id, extension]));
  const ordered: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const missingDependencyIds = new Set<string>();
  const cyclicDependencyIds = new Set<string>();

  function visit(extensionId: string) {
    if (visited.has(extensionId)) return;
    if (visiting.has(extensionId)) {
      cyclicDependencyIds.add(extensionId);
      return;
    }

    const extension = byId.get(extensionId);
    if (!extension) {
      missingDependencyIds.add(extensionId);
      return;
    }

    visiting.add(extensionId);
    for (const dependencyId of getDefaultExtensionDependencyIds(extension)) {
      if (!byId.has(dependencyId)) {
        missingDependencyIds.add(dependencyId);
        continue;
      }
      visit(dependencyId);
    }
    visiting.delete(extensionId);

    visited.add(extensionId);
    ordered.push(extensionId);
  }

  for (const extensionId of normalizeDefaultExtensionIds(extensionIds)) {
    visit(extensionId);
  }

  return {
    extensionIds: ordered,
    missingDependencyIds: [...missingDependencyIds],
    cyclicDependencyIds: [...cyclicDependencyIds],
  };
}

export function resolveDefaultExtensionDependentIds(
  extensionIds: readonly string[],
  installedExtensionIds: readonly string[],
  extensions: readonly DefaultExtensionDescriptor[] = DEFAULT_EXTENSION_MANIFESTS,
): string[] {
  const targetIds = new Set(normalizeDefaultExtensionIds(extensionIds));
  const installedIds = new Set(normalizeDefaultExtensionIds(installedExtensionIds));
  const dependents: string[] = [];

  for (const extension of extensions) {
    const extensionId = extension.manifest.id;
    if (!installedIds.has(extensionId) || targetIds.has(extensionId)) continue;
    const plan = resolveDefaultExtensionDependencyPlan([extensionId], extensions);
    const dependencyIds = plan.extensionIds.filter((candidateId) => candidateId !== extensionId);
    if (dependencyIds.some((dependencyId) => targetIds.has(dependencyId))) {
      dependents.push(extensionId);
    }
  }

  return dependents;
}

function hasRuntimeEvents(extension: DefaultExtensionDescriptor): boolean {
  const runtimeEvents = extension.marketplace.metadata?.runtimeEvents ?? extension.manifest.metadata?.runtimeEvents;
  return Boolean(extension.manifest.events?.length || (Array.isArray(runtimeEvents) && runtimeEvents.length));
}

function isExtensionMarketplaceCategory(value: unknown): value is ExtensionMarketplaceCategory {
  return typeof value === 'string' && (EXTENSION_MARKETPLACE_CATEGORIES as string[]).includes(value);
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function isHarnessPlugin(plugin: HarnessPlugin | undefined): plugin is HarnessPlugin {
  return Boolean(plugin);
}

function dedupeRenderers(renderers: readonly HarnessRendererDefinition[]): HarnessRendererDefinition[] {
  const byId = new Map<string, HarnessRendererDefinition>();
  for (const renderer of renderers) {
    if (!byId.has(renderer.id)) byId.set(renderer.id, renderer);
  }
  return [...byId.values()];
}
