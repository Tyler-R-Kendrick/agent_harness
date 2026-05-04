import {
  createHarnessExtensionContext,
  parseHarnessPluginManifest,
  parseHarnessPluginMarketplaceManifest,
  type Command,
  type HarnessHook,
  type HarnessPlugin,
  type HarnessPluginManifest,
  type HarnessPluginMarketplaceManifest,
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
import agentSkillsManifestSource from '../../../ext/agent-skills/agent-harness.plugin.json';
import agentsMdManifestSource from '../../../ext/agents-md/agent-harness.plugin.json';
import artifactsManifestSource from '../../../ext/artifacts/agent-harness.plugin.json';
import designMdManifestSource from '../../../ext/design-md/agent-harness.plugin.json';
import symphonyManifestSource from '../../../ext/symphony/agent-harness.plugin.json';
import localModelConnectorManifestSource from '../../../ext/local-model-connector/agent-harness.plugin.json';
import workflowCanvasManifestSource from '../../../ext/workflow-canvas/agent-harness.plugin.json';

export interface DefaultExtensionDescriptor {
  marketplace: HarnessPluginMarketplaceManifest['plugins'][number];
  manifest: HarnessPluginManifest;
}

export interface DefaultExtensionSummary {
  pluginCount: number;
  hookCount: number;
  toolCount: number;
  commandCount: number;
}

export interface DefaultExtensionRuntime {
  extensions: DefaultExtensionDescriptor[];
  installedExtensionIds: string[];
  plugins: HarnessPlugin[];
  hooks: HarnessHook<InferenceMessagesPayload<MemoryMessage>>[];
  tools: HarnessToolDefinition[];
  commands: Command[];
}

export interface CreateDefaultExtensionRuntimeOptions {
  installedExtensionIds?: readonly string[];
}

export const DEFAULT_EXTENSION_MARKETPLACE = parseHarnessPluginMarketplaceManifest(marketplaceManifestSource);
export const DEFAULT_EXTENSION_MARKETPLACES: HarnessPluginMarketplaceManifest[] = [DEFAULT_EXTENSION_MARKETPLACE];

const DEFAULT_MANIFESTS_BY_ID = new Map([
  ['agent-harness.ext.agent-skills', parseHarnessPluginManifest(agentSkillsManifestSource)],
  ['agent-harness.ext.agents-md', parseHarnessPluginManifest(agentsMdManifestSource)],
  ['agent-harness.ext.design-md', parseHarnessPluginManifest(designMdManifestSource)],
  ['agent-harness.ext.symphony', parseHarnessPluginManifest(symphonyManifestSource)],
  ['agent-harness.ext.workflow-canvas', parseHarnessPluginManifest(workflowCanvasManifestSource)],
  ['agent-harness.ext.artifacts', parseHarnessPluginManifest(artifactsManifestSource)],
  ['agent-harness.ext.local-model-connector', parseHarnessPluginManifest(localModelConnectorManifestSource)],
]);

export const DEFAULT_EXTENSION_MANIFESTS: DefaultExtensionDescriptor[] = DEFAULT_EXTENSION_MARKETPLACE.plugins.map((marketplace) => {
  const manifest = DEFAULT_MANIFESTS_BY_ID.get(marketplace.id);
  if (!manifest) {
    throw new Error(`Missing default extension manifest: ${marketplace.id}`);
  }
  return { marketplace, manifest };
});

const EMPTY_EXTENSION_SUMMARY: DefaultExtensionSummary = Object.freeze({
  pluginCount: 0,
  hookCount: 0,
  toolCount: 0,
  commandCount: 0,
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
    ['agent-harness.ext.design-md', () => createDesignMdPlugin({ documents: designDocuments })],
    ['agent-harness.ext.symphony', () => createSymphonyPlugin(workspaceFiles)],
    ['agent-harness.ext.workflow-canvas', () => createWorkflowCanvasPlugin()],
    ['agent-harness.ext.artifacts', () => createArtifactsPlugin()],
    ['agent-harness.ext.local-model-connector', () => createLocalModelConnectorPlugin()],
  ]);

  await context.plugins.loadAll(installedExtensionIds.map((extensionId) => pluginFactories.get(extensionId)?.()).filter(isHarnessPlugin));

  return {
    extensions: DEFAULT_EXTENSION_MANIFESTS,
    installedExtensionIds,
    plugins: context.plugins.list(),
    hooks: context.hooks.list(),
    tools: context.tools.list(),
    commands: context.commands.list(),
  };
}

export function summarizeDefaultExtensionRuntime(runtime: DefaultExtensionRuntime | null): DefaultExtensionSummary {
  if (!runtime) return EMPTY_EXTENSION_SUMMARY;
  return {
    pluginCount: runtime.plugins.length,
    hookCount: runtime.hooks.length,
    toolCount: runtime.tools.length,
    commandCount: runtime.commands.length,
  };
}

function selectInstalledDefaultExtensionIds(installedExtensionIds: readonly string[]): string[] {
  const requested = new Set(installedExtensionIds);
  return DEFAULT_EXTENSION_MANIFESTS
    .map((extension) => extension.manifest.id)
    .filter((extensionId) => requested.has(extensionId));
}

function isHarnessPlugin(plugin: HarnessPlugin | undefined): plugin is HarnessPlugin {
  return Boolean(plugin);
}
