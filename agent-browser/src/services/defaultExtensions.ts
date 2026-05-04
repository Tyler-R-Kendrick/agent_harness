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

import marketplaceManifestSource from '../../../ext/agent-harness.marketplace.json';
import agentSkillsManifestSource from '../../../ext/agent-skills/agent-harness.plugin.json';
import agentsMdManifestSource from '../../../ext/agents-md/agent-harness.plugin.json';
import artifactsManifestSource from '../../../ext/artifacts/agent-harness.plugin.json';
import designMdManifestSource from '../../../ext/design-md/agent-harness.plugin.json';
import symphonyManifestSource from '../../../ext/symphony/agent-harness.plugin.json';

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
  plugins: HarnessPlugin[];
  hooks: HarnessHook<InferenceMessagesPayload<MemoryMessage>>[];
  tools: HarnessToolDefinition[];
  commands: Command[];
}

export const DEFAULT_EXTENSION_MARKETPLACE = parseHarnessPluginMarketplaceManifest(marketplaceManifestSource);

const DEFAULT_MANIFESTS_BY_ID = new Map([
  ['agent-harness.ext.agent-skills', parseHarnessPluginManifest(agentSkillsManifestSource)],
  ['agent-harness.ext.agents-md', parseHarnessPluginManifest(agentsMdManifestSource)],
  ['agent-harness.ext.design-md', parseHarnessPluginManifest(designMdManifestSource)],
  ['agent-harness.ext.symphony', parseHarnessPluginManifest(symphonyManifestSource)],
  ['agent-harness.ext.artifacts', parseHarnessPluginManifest(artifactsManifestSource)],
]);

export const DEFAULT_EXTENSION_MANIFESTS: DefaultExtensionDescriptor[] = DEFAULT_EXTENSION_MARKETPLACE.plugins.map((marketplace) => {
  const manifest = DEFAULT_MANIFESTS_BY_ID.get(marketplace.id);
  if (!manifest) {
    throw new Error(`Missing default extension manifest: ${marketplace.id}`);
  }
  return { marketplace, manifest };
});

export const DEFAULT_EXTENSION_MANIFEST_SUMMARY = summarizeDefaultExtensionDescriptors(DEFAULT_EXTENSION_MANIFESTS);

export async function createDefaultExtensionRuntime(
  workspaceFiles: readonly WorkspaceFile[],
): Promise<DefaultExtensionRuntime> {
  const context = createHarnessExtensionContext<MemoryMessage, InferenceMessagesPayload<MemoryMessage>>();
  const designDocuments = workspaceFiles
    .filter((file) => file.path === 'DESIGN.md' || file.path.endsWith('/Design.md') || file.path.endsWith('/DESIGN.md'))
    .map((file) => ({ path: file.path, content: file.content }));

  await context.plugins.loadAll([
    createAgentSkillsPlugin(workspaceFiles, {
      client: {
        executeSkill({ skill }) {
          throw new Error(`Agent skill "${skill.name}" cannot run until a session skill runner is connected.`);
        },
      },
    }),
    createAgentsMdHookPlugin(workspaceFiles),
    createDesignMdPlugin({ documents: designDocuments }),
    createSymphonyPlugin(workspaceFiles),
    createArtifactsPlugin(),
  ]);

  return {
    extensions: DEFAULT_EXTENSION_MANIFESTS,
    plugins: context.plugins.list(),
    hooks: context.hooks.list(),
    tools: context.tools.list(),
    commands: context.commands.list(),
  };
}

export function summarizeDefaultExtensionRuntime(runtime: DefaultExtensionRuntime | null): DefaultExtensionSummary {
  if (!runtime) return DEFAULT_EXTENSION_MANIFEST_SUMMARY;
  return {
    pluginCount: runtime.plugins.length,
    hookCount: runtime.hooks.length,
    toolCount: runtime.tools.length,
    commandCount: runtime.commands.length,
  };
}

function summarizeDefaultExtensionDescriptors(extensions: readonly DefaultExtensionDescriptor[]): DefaultExtensionSummary {
  return {
    pluginCount: extensions.length,
    hookCount: countCapabilities(extensions, 'hook'),
    toolCount: countCapabilities(extensions, 'tool'),
    commandCount: countCapabilities(extensions, 'command'),
  };
}

function countCapabilities(
  extensions: readonly DefaultExtensionDescriptor[],
  kind: HarnessPluginManifest['capabilities'] extends Array<infer Capability> | undefined
    ? Capability extends { kind: infer Kind }
      ? Kind
      : never
    : never,
): number {
  return extensions.reduce((total, extension) => (
    total + (extension.manifest.capabilities ?? []).filter((capability) => capability.kind === kind).length
  ), 0);
}
