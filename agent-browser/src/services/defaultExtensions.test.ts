import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EXTENSION_MANIFESTS,
  DEFAULT_EXTENSION_MARKETPLACE,
  DEFAULT_EXTENSION_MARKETPLACES,
  createDefaultExtensionRuntime,
  getDefaultExtensionAvailability,
  getDefaultExtensionOpenFeatureFlagKey,
  getDefaultExtensionDependencyIds,
  getExtensionMarketplaceCategory,
  getInstalledDefaultExtensionDescriptors,
  resolveDefaultExtensionDependencyPlan,
  resolveDefaultExtensionDependentIds,
  groupDefaultExtensionsByMarketplaceCategory,
  normalizeDefaultExtensionIds,
  resolveEnabledDefaultExtensionIds,
} from './defaultExtensions';

describe('default extensions', () => {
  it('defines the monorepo marketplace as the default marketplace source', () => {
    expect(DEFAULT_EXTENSION_MARKETPLACE.publisher.id).toBe('agent-harness');
    expect(DEFAULT_EXTENSION_MARKETPLACE.name).toBe('Agent Harness default marketplace');
    expect(DEFAULT_EXTENSION_MARKETPLACES).toEqual([DEFAULT_EXTENSION_MARKETPLACE]);
    expect(DEFAULT_EXTENSION_MARKETPLACE.plugins.some((plugin) => plugin.default === true)).toBe(false);

    const grouped = groupDefaultExtensionsByMarketplaceCategory(DEFAULT_EXTENSION_MANIFESTS);
    expect(grouped.ide).toEqual(expect.arrayContaining([
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.open-design' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.workflow-canvas' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.artifacts-worktree' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.symphony' }) }),
    ]));
    expect(grouped.harness).toEqual(expect.arrayContaining([
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.agent-skills' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.agents-md' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.design-md-context' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.artifacts-context' }) }),
    ]));
    expect(grouped.worker).toEqual(expect.arrayContaining([
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.local-inference-daemon' }) }),
    ]));
    expect(grouped.provider).toEqual(expect.arrayContaining([
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.huggingface-model-provider' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.openai-model-provider' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.azure-inference-model-provider' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.aws-bedrock-model-provider' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.anthropic-model-provider' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.xai-model-provider' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.ghcp-model-provider' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.cursor-model-provider' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.codex-model-provider' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.local-model-connector' }) }),
    ]));
    expect(DEFAULT_EXTENSION_MANIFESTS.map((extension) => extension.manifest.id)).toEqual([
      'agent-harness.ext.agent-skills',
      'agent-harness.ext.agents-md',
      'agent-harness.ext.design-md-context',
      'agent-harness.ext.open-design',
      'agent-harness.ext.symphony',
      'agent-harness.ext.workflow-canvas',
      'agent-harness.ext.artifacts-context',
      'agent-harness.ext.artifacts-worktree',
      'agent-harness.ext.huggingface-model-provider',
      'agent-harness.ext.ghcp-model-provider',
      'agent-harness.ext.cursor-model-provider',
      'agent-harness.ext.codex-model-provider',
      'agent-harness.ext.openai-model-provider',
      'agent-harness.ext.azure-inference-model-provider',
      'agent-harness.ext.aws-bedrock-model-provider',
      'agent-harness.ext.anthropic-model-provider',
      'agent-harness.ext.xai-model-provider',
      'agent-harness.ext.local-model-connector',
      'agent-harness.ext.local-inference-daemon',
    ]);
  });

  it('keeps repo marketplace extensions installable without loading plugins by default', async () => {
    const runtime = await createDefaultExtensionRuntime([]);

    expect(runtime.extensions.map((extension) => extension.manifest.name)).toEqual([
      'Agent skills',
      'AGENTS.md workspace instructions',
      'DESIGN.md agent guidance',
      'OpenDesign DESIGN.md Studio',
      'Symphony internal task orchestration',
      'Workflow canvas orchestration',
      'Artifact context',
      'Artifact worktree explorer',
      'Hugging Face Browser Models',
      'GitHub Copilot Models',
      'Cursor Models',
      'Codex Models',
      'OpenAI Models',
      'Azure AI Inference Models',
      'AWS Bedrock Models',
      'Anthropic Models',
      'xAI Models',
      'Local Model Connector',
      'Local Inference Worker',
    ]);
    expect(runtime.installedExtensionIds).toEqual([]);
    expect(runtime.plugins).toEqual([]);
    expect(runtime.hooks).toEqual([]);
    expect(runtime.commands.map((command) => command.id)).not.toContain('agent-skills');
    expect(runtime.commands.map((command) => command.id)).not.toContain('artifacts.new');
    expect(runtime.tools).toEqual([]);
  });

  it('loads only marketplace extensions selected for installation', async () => {
    const runtime = await createDefaultExtensionRuntime([], {
      installedExtensionIds: [
        'agent-harness.ext.symphony',
        'agent-harness.ext.workflow-canvas',
        'agent-harness.ext.artifacts-context',
      ],
    });

    expect(runtime.installedExtensionIds).toEqual([
      'agent-harness.ext.symphony',
      'agent-harness.ext.workflow-canvas',
      'agent-harness.ext.artifacts-context',
    ]);
    expect(runtime.plugins.map((plugin) => plugin.id)).toEqual([
      'symphony',
      'workflow-canvas',
      'artifacts',
    ]);
    expect(runtime.hooks.map((hook) => hook.id)).toEqual([
      'symphony.workflow-md',
    ]);
    expect(runtime.commands.map((command) => command.id)).toContain('artifacts.new');
    expect(runtime.renderers.map((renderer) => renderer.id)).toEqual(expect.arrayContaining([
      'workflow-canvas.renderer',
    ]));
    expect(runtime.tools.map((tool) => tool.id)).toEqual(expect.arrayContaining([
      'workflow-canvas.inventory',
      'workflow-canvas.validate',
      'workflow-canvas.create',
      'workflow-canvas.read',
      'workflow-canvas.export',
      'artifacts.create',
      'artifacts.list',
      'artifacts.read',
      'artifacts.update',
    ]));
    expect(runtime.extensions.find((extension) => extension.manifest.id === 'agent-harness.ext.local-model-connector'))
      .toMatchObject({
        marketplace: {
          manifest: './provider/local-model-connector/agent-harness.plugin.json',
          source: { path: './provider/local-model-connector/dist' },
          categories: expect.arrayContaining(['provider-extension']),
        },
        manifest: {
          capabilities: expect.arrayContaining([
            expect.objectContaining({ kind: 'asset', id: 'local-model-connector-extension' }),
          ]),
        },
      });
    expect(runtime.extensions.find((extension) => extension.manifest.id === 'agent-harness.ext.ghcp-model-provider'))
      .toMatchObject({
        marketplace: {
          categories: expect.arrayContaining(['model-provider']),
        },
        manifest: {
          capabilities: expect.arrayContaining([
            expect.objectContaining({ kind: 'model-provider', id: 'ghcp' }),
          ]),
          contributes: {
            modelProviders: expect.arrayContaining([
              expect.objectContaining({
                id: 'ghcp',
                kind: 'github-copilot',
                providerIds: ['ghcp'],
              }),
            ]),
          },
        },
      });
    expect(runtime.extensions.find((extension) => extension.manifest.id === 'agent-harness.ext.codex-model-provider'))
      .toMatchObject({
        manifest: {
          contributes: {
            modelProviders: expect.arrayContaining([
              expect.objectContaining({
                id: 'codex',
                kind: 'codex-cli',
                providerIds: ['codex'],
              }),
            ]),
          },
        },
      });
    expect(runtime.extensions.find((extension) => extension.manifest.id === 'agent-harness.ext.local-inference-daemon'))
      .toMatchObject({
        marketplace: {
          manifest: './worker/local-inference-worker/agent-harness.plugin.json',
          source: { path: './worker/local-inference-worker/dist' },
          categories: expect.arrayContaining(['worker-extension']),
          metadata: expect.objectContaining({
            externalInstallDetection: 'webrtc-peer',
          }),
        },
        manifest: {
          capabilities: expect.arrayContaining([
            expect.objectContaining({ kind: 'asset', id: 'local-inference-daemon-service' }),
          ]),
          assets: expect.arrayContaining([
            expect.objectContaining({
              kind: 'runtime',
              path: './dist/agent-harness-local-inference-daemon.zip',
            }),
          ]),
        },
      });
  });

  it('loads selected model provider extensions as metadata plugins', async () => {
    const runtime = await createDefaultExtensionRuntime([], {
      installedExtensionIds: [
        'agent-harness.ext.ghcp-model-provider',
        'agent-harness.ext.codex-model-provider',
      ],
    });

    expect(runtime.installedExtensionIds).toEqual([
      'agent-harness.ext.ghcp-model-provider',
      'agent-harness.ext.codex-model-provider',
    ]);
    expect(runtime.plugins.map((plugin) => plugin.id)).toEqual([
      'ghcp-model-provider',
      'codex-model-provider',
    ]);
  });

  it('lists installed descriptors and keeps their marketplace categories', async () => {
    const runtime = await createDefaultExtensionRuntime([], {
      installedExtensionIds: [
        'agent-harness.ext.design-md-context',
        'agent-harness.ext.agents-md',
        'agent-harness.ext.symphony',
      ],
    });

    const installed = getInstalledDefaultExtensionDescriptors(runtime);

    expect(installed.map((extension) => extension.manifest.id)).toEqual([
      'agent-harness.ext.agents-md',
      'agent-harness.ext.design-md-context',
      'agent-harness.ext.symphony',
    ]);
    expect(installed.map(getExtensionMarketplaceCategory)).toEqual([
      'harness',
      'harness',
      'ide',
    ]);
  });

  it('normalizes pre-split extension ids into the current installable surfaces', () => {
    expect(normalizeDefaultExtensionIds([
      'agent-harness.ext.design-md',
      'agent-harness.ext.artifacts',
      'agent-harness.ext.symphony',
      'agent-harness.ext.unknown',
    ])).toEqual([
      'agent-harness.ext.design-md-context',
      'agent-harness.ext.open-design',
      'agent-harness.ext.artifacts-context',
      'agent-harness.ext.artifacts-worktree',
      'agent-harness.ext.symphony',
    ]);
  });

  it('uses OpenFeature-style boolean flags to resolve enabled installed extensions', () => {
    const symphonyFlag = getDefaultExtensionOpenFeatureFlagKey('agent-harness.ext.symphony');
    expect(symphonyFlag).toBe('agent-harness.extensions.agent-harness.ext.symphony.enabled');
    expect(resolveEnabledDefaultExtensionIds([
      'agent-harness.ext.symphony',
      'agent-harness.ext.workflow-canvas',
    ], {
      [symphonyFlag]: false,
    })).toEqual(['agent-harness.ext.workflow-canvas']);
  });

  it('marks listed-but-unavailable provider extensions as disabled marketplace choices', () => {
    const openAi = DEFAULT_EXTENSION_MANIFESTS.find((extension) => extension.manifest.id === 'agent-harness.ext.openai-model-provider');
    expect(openAi).toBeDefined();
    expect(getDefaultExtensionAvailability(openAi!)).toEqual({
      state: 'unavailable',
      reason: 'Provider adapter is listed for marketplace planning but is not bundled in this runtime yet.',
    });

    const huggingFace = DEFAULT_EXTENSION_MANIFESTS.find((extension) => extension.manifest.id === 'agent-harness.ext.huggingface-model-provider');
    expect(huggingFace).toBeDefined();
    expect(getDefaultExtensionAvailability(huggingFace!)).toEqual({ state: 'available' });
  });

  it('resolves transitive dependencies in dependency-first install order', async () => {
    const openDesign = DEFAULT_EXTENSION_MANIFESTS.find((extension) => extension.manifest.id === 'agent-harness.ext.open-design');
    const artifactsWorktree = DEFAULT_EXTENSION_MANIFESTS.find((extension) => extension.manifest.id === 'agent-harness.ext.artifacts-worktree');
    expect(openDesign).toBeDefined();
    expect(artifactsWorktree).toBeDefined();

    expect(getDefaultExtensionDependencyIds(openDesign!)).toEqual(['agent-harness.ext.design-md-context']);
    expect(getDefaultExtensionDependencyIds(artifactsWorktree!)).toEqual(['agent-harness.ext.artifacts-context']);

    const plan = resolveDefaultExtensionDependencyPlan([
      'agent-harness.ext.open-design',
      'agent-harness.ext.artifacts-worktree',
    ]);

    expect(plan.extensionIds).toEqual([
      'agent-harness.ext.design-md-context',
      'agent-harness.ext.open-design',
      'agent-harness.ext.artifacts-context',
      'agent-harness.ext.artifacts-worktree',
    ]);
    expect(plan.missingDependencyIds).toEqual([]);
    expect(plan.cyclicDependencyIds).toEqual([]);

    const runtime = await createDefaultExtensionRuntime([], {
      installedExtensionIds: ['agent-harness.ext.open-design'],
    });
    expect(runtime.installedExtensionIds).toEqual([
      'agent-harness.ext.design-md-context',
      'agent-harness.ext.open-design',
    ]);
  });

  it('finds installed dependents so uninstalling a base extension can remove derivatives', () => {
    expect(resolveDefaultExtensionDependentIds(
      ['agent-harness.ext.design-md-context'],
      ['agent-harness.ext.design-md-context', 'agent-harness.ext.open-design'],
    )).toEqual(['agent-harness.ext.open-design']);

    expect(resolveDefaultExtensionDependentIds(
      ['agent-harness.ext.artifacts-context'],
      ['agent-harness.ext.artifacts-context', 'agent-harness.ext.artifacts-worktree'],
    )).toEqual(['agent-harness.ext.artifacts-worktree']);
  });
});
