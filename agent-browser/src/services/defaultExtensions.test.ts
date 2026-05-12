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
  isDefaultExtensionActivityFeature,
  getInstalledDefaultExtensionDescriptors,
  resolveDefaultExtensionDependencyPlan,
  resolveDefaultExtensionDependentIds,
  groupDefaultExtensionsByMarketplaceCategory,
  normalizeDefaultExtensionIds,
  resolveEnabledDefaultExtensionIds,
} from './defaultExtensions';
import { createArtifact } from './artifacts';
import { resolveArtifactFileRenderer } from './mediaRenderers';

describe('default extensions', () => {
  it('defines the monorepo marketplace as the default marketplace source', () => {
    expect(DEFAULT_EXTENSION_MARKETPLACE.publisher.id).toBe('agent-harness');
    expect(DEFAULT_EXTENSION_MARKETPLACE.name).toBe('Agent Harness default marketplace');
    expect(DEFAULT_EXTENSION_MARKETPLACES).toEqual([DEFAULT_EXTENSION_MARKETPLACE]);
    expect(DEFAULT_EXTENSION_MARKETPLACE.plugins.some((plugin) => plugin.default === true)).toBe(false);

    const grouped = groupDefaultExtensionsByMarketplaceCategory(DEFAULT_EXTENSION_MANIFESTS);
    expect(grouped.ide).toEqual(expect.arrayContaining([
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.markdown-preview' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.design-studio' }) }),
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
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.google-ai-edge-model-provider' }) }),
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
    expect(grouped.channel).toEqual(expect.arrayContaining([
      expect.objectContaining({
        manifest: expect.objectContaining({
          id: 'agent-harness.ext.external-channels',
          contributes: {
            channels: expect.arrayContaining([
              expect.objectContaining({ id: 'slack', kind: 'slack' }),
              expect.objectContaining({ id: 'telegram', kind: 'telegram' }),
              expect.objectContaining({ id: 'sms', kind: 'sms' }),
            ]),
          },
        }),
      }),
    ]));
    expect(DEFAULT_EXTENSION_MANIFESTS.map((extension) => extension.manifest.id)).toEqual([
      'agent-harness.ext.agent-skills',
      'agent-harness.ext.agents-md',
      'agent-harness.ext.design-md-context',
      'agent-harness.ext.markdown-preview',
      'agent-harness.ext.design-studio',
      'agent-harness.ext.symphony',
      'agent-harness.ext.workflow-canvas',
      'agent-harness.ext.artifacts-context',
      'agent-harness.ext.artifacts-worktree',
      'agent-harness.ext.huggingface-model-provider',
      'agent-harness.ext.google-ai-edge-model-provider',
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
      'agent-harness.ext.external-channels',
    ]);
  });

  it('keeps repo marketplace extensions installable without loading plugins by default', async () => {
    const runtime = await createDefaultExtensionRuntime([]);

    expect(runtime.extensions.map((extension) => extension.manifest.name)).toEqual([
      'Agent skills',
      'AGENTS.md workspace instructions',
      'DESIGN.md agent guidance',
      'Markdown preview',
      'Design Studio',
      'Symphony internal task orchestration',
      'Workflow canvas orchestration',
      'Artifact context',
      'Artifact worktree explorer',
      'Hugging Face Browser Models',
      'Google AI Edge Browser Models',
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
      'External Chat Channels',
    ]);
    expect(runtime.installedExtensionIds).toEqual(['agent-harness.ext.markdown-preview']);
    expect(runtime.plugins).toEqual([]);
    expect(runtime.hooks).toEqual([]);
    expect(runtime.commands.map((command) => command.id)).not.toContain('agent-skills');
    expect(runtime.commands.map((command) => command.id)).not.toContain('artifacts.new');
    expect(runtime.tools).toEqual([]);
    expect(runtime.renderers.map((renderer) => renderer.id)).toContain('markdown-preview.renderer');
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
      'agent-harness.ext.markdown-preview',
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
      'markdown-preview.renderer',
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

  it('loads DESIGN.md guidance from artifact-backed Design Studio projects', async () => {
    const designArtifact = createArtifact({
      id: 'design-studio-signal-desk',
      title: 'Signal Desk',
      kind: 'design-studio-project',
      files: [
        {
          path: 'DESIGN.md',
          content: [
            '---',
            'name: Signal Desk',
            'colors:',
            '  accent: "#4dd0e1"',
            '---',
            '',
            'Use quiet operations-dashboard styling.',
          ].join('\n'),
        },
      ],
    }, { now: () => '2026-05-11T14:00:00.000Z' });

    const runtime = await createDefaultExtensionRuntime([], {
      installedExtensionIds: ['agent-harness.ext.design-md-context'],
      artifacts: [designArtifact],
    });
    const hook = runtime.hooks.find((candidate) => candidate.id === 'design-md.semantic-guidance');

    const result = await hook?.run({
      point: 'before-llm-messages',
      payload: {
        messages: [{ role: 'user', content: 'Polish the dashboard UI.' }],
      },
      metadata: { targetPath: 'src/App.tsx' },
    });

    expect(result?.output).toMatchObject({
      applied: true,
      designPath: '//artifacts/design-studio-signal-desk/DESIGN.md',
    });
    expect(result?.payload?.messages[0].content).toContain('DESIGN.md: Signal Desk');
    expect(result?.payload?.messages[0].content).toContain('Use quiet operations-dashboard styling.');
  });

  it('loads selected model provider extensions as metadata plugins', async () => {
    const runtime = await createDefaultExtensionRuntime([], {
      installedExtensionIds: [
        'agent-harness.ext.ghcp-model-provider',
        'agent-harness.ext.codex-model-provider',
      ],
    });

    expect(runtime.installedExtensionIds).toEqual([
      'agent-harness.ext.markdown-preview',
      'agent-harness.ext.ghcp-model-provider',
      'agent-harness.ext.codex-model-provider',
    ]);
    expect(runtime.plugins.map((plugin) => plugin.id)).toEqual([
      'ghcp-model-provider',
      'codex-model-provider',
    ]);
  });

  it('lists Google AI Edge as a browser-local model provider with built-in AI API support', async () => {
    const runtime = await createDefaultExtensionRuntime([], {
      installedExtensionIds: ['agent-harness.ext.google-ai-edge-model-provider'],
    });
    const googleAiEdge = runtime.extensions.find((extension) => extension.manifest.id === 'agent-harness.ext.google-ai-edge-model-provider');

    expect(googleAiEdge).toMatchObject({
      marketplace: {
        name: 'Google AI Edge Browser Models',
        categories: expect.arrayContaining(['provider-extension', 'model-provider', 'browser-local']),
        metadata: expect.objectContaining({
          marketplaceCategory: 'provider',
          accountConfig: 'google-ai-edge-browser',
        }),
        keywords: expect.arrayContaining(['google-ai-edge', 'mediapipe', 'built-in-ai']),
      },
      manifest: {
        name: 'Google AI Edge Browser Models',
        activationEvents: expect.arrayContaining([
          'onModelProvider:google-ai-edge',
          'onModelProvider:chrome-built-in-ai',
        ]),
        contributes: {
          modelProviders: expect.arrayContaining([
            expect.objectContaining({
              id: 'google-ai-edge',
              label: 'Google AI Edge',
              kind: 'browser-local',
              providerIds: ['google-ai-edge'],
            }),
            expect.objectContaining({
              id: 'chrome-built-in-ai',
              label: 'Chrome Built-in AI',
              kind: 'browser-local',
              providerIds: ['chrome-built-in-ai'],
            }),
          ]),
        },
        capabilities: expect.arrayContaining([
          expect.objectContaining({ kind: 'model-provider', id: 'google-ai-edge' }),
          expect.objectContaining({ kind: 'model-provider', id: 'chrome-built-in-ai' }),
        ]),
      },
    });
    expect(runtime.installedExtensionIds).toEqual([
      'agent-harness.ext.markdown-preview',
      'agent-harness.ext.google-ai-edge-model-provider',
    ]);
    expect(runtime.plugins.map((plugin) => plugin.id)).toEqual(['google-ai-edge-model-provider']);
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
      'agent-harness.ext.markdown-preview',
      'agent-harness.ext.symphony',
    ]);
    expect(installed.map(getExtensionMarketplaceCategory)).toEqual([
      'harness',
      'harness',
      'ide',
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
      'agent-harness.ext.design-studio',
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
    })).toEqual(['agent-harness.ext.markdown-preview', 'agent-harness.ext.workflow-canvas']);
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
    const designStudio = DEFAULT_EXTENSION_MANIFESTS.find((extension) => extension.manifest.id === 'agent-harness.ext.design-studio');
    const markdownPreview = DEFAULT_EXTENSION_MANIFESTS.find((extension) => extension.manifest.id === 'agent-harness.ext.markdown-preview');
    const artifactsWorktree = DEFAULT_EXTENSION_MANIFESTS.find((extension) => extension.manifest.id === 'agent-harness.ext.artifacts-worktree');
    expect(designStudio).toBeDefined();
    expect(markdownPreview).toBeDefined();
    expect(artifactsWorktree).toBeDefined();

    expect(getDefaultExtensionDependencyIds(designStudio!)).toEqual([
      'agent-harness.ext.design-md-context',
      'agent-harness.ext.artifacts-context',
      'agent-harness.ext.artifacts-worktree',
    ]);
    expect(getDefaultExtensionDependencyIds(markdownPreview!)).toEqual([]);
    expect(getDefaultExtensionDependencyIds(artifactsWorktree!)).toEqual(['agent-harness.ext.artifacts-context']);

    const plan = resolveDefaultExtensionDependencyPlan([
      'agent-harness.ext.design-studio',
      'agent-harness.ext.artifacts-worktree',
    ]);

    expect(plan.extensionIds).toEqual([
      'agent-harness.ext.design-md-context',
      'agent-harness.ext.artifacts-context',
      'agent-harness.ext.artifacts-worktree',
      'agent-harness.ext.design-studio',
    ]);
    expect(plan.missingDependencyIds).toEqual([]);
    expect(plan.cyclicDependencyIds).toEqual([]);

    const runtime = await createDefaultExtensionRuntime([], {
      installedExtensionIds: ['agent-harness.ext.design-studio'],
    });
    expect(runtime.installedExtensionIds).toEqual([
      'agent-harness.ext.markdown-preview',
      'agent-harness.ext.design-md-context',
      'agent-harness.ext.artifacts-context',
      'agent-harness.ext.artifacts-worktree',
      'agent-harness.ext.design-studio',
    ]);
  });

  it('does not expose workspace-tree-only extensions as activity-bar features', () => {
    const designStudio = DEFAULT_EXTENSION_MANIFESTS.find((extension) => extension.manifest.id === 'agent-harness.ext.design-studio');
    const markdownPreview = DEFAULT_EXTENSION_MANIFESTS.find((extension) => extension.manifest.id === 'agent-harness.ext.markdown-preview');
    const symphony = DEFAULT_EXTENSION_MANIFESTS.find((extension) => extension.manifest.id === 'agent-harness.ext.symphony');
    const workflowCanvas = DEFAULT_EXTENSION_MANIFESTS.find((extension) => extension.manifest.id === 'agent-harness.ext.workflow-canvas');
    const artifactsWorktree = DEFAULT_EXTENSION_MANIFESTS.find((extension) => extension.manifest.id === 'agent-harness.ext.artifacts-worktree');

    expect(markdownPreview).toBeDefined();
    expect(designStudio).toBeDefined();
    expect(symphony).toBeDefined();
    expect(workflowCanvas).toBeDefined();
    expect(artifactsWorktree).toBeDefined();
    expect(isDefaultExtensionActivityFeature(markdownPreview!)).toBe(false);
    expect(isDefaultExtensionActivityFeature(designStudio!)).toBe(true);
    expect(isDefaultExtensionActivityFeature(symphony!)).toBe(true);
    expect(isDefaultExtensionActivityFeature(workflowCanvas!)).toBe(true);
    expect(isDefaultExtensionActivityFeature(artifactsWorktree!)).toBe(false);
  });

  it('finds installed dependents so uninstalling a base extension can remove derivatives', () => {
    expect(resolveDefaultExtensionDependentIds(
      ['agent-harness.ext.design-md-context'],
      ['agent-harness.ext.design-md-context', 'agent-harness.ext.design-studio'],
    )).toEqual(['agent-harness.ext.design-studio']);

    expect(resolveDefaultExtensionDependentIds(
      ['agent-harness.ext.artifacts-context'],
      ['agent-harness.ext.artifacts-context', 'agent-harness.ext.artifacts-worktree'],
    )).toEqual(['agent-harness.ext.artifacts-worktree']);
  });

  it('binds default markdown files to the markdown preview renderer without Design Studio hijacking them', async () => {
    const runtime = await createDefaultExtensionRuntime([], {
      installedExtensionIds: ['agent-harness.ext.design-studio'],
    });

    expect(resolveArtifactFileRenderer({
      path: 'canvas-ws-research-checklist/checklist.md',
      mediaType: 'text/markdown',
      content: '# Research Checklist\n\n- [ ] Capture task intent',
    }, { extensionRenderers: runtime.renderers })).toEqual(expect.objectContaining({
      kind: 'plugin',
      rendererId: 'markdown-preview.renderer',
      implementationRuntime: 'react',
    }));
    expect(resolveArtifactFileRenderer({
      path: 'notes/decision.mdx',
      mediaType: 'text/mdx',
      content: '# Decision\n\n<Component />',
    }, { extensionRenderers: runtime.renderers })).toEqual(expect.objectContaining({
      kind: 'plugin',
      rendererId: 'markdown-preview.renderer',
      implementationRuntime: 'react',
    }));
    expect(resolveArtifactFileRenderer({
      path: 'DESIGN.md',
      mediaType: 'text/markdown',
      content: '# DESIGN.md',
    }, { extensionRenderers: runtime.renderers })).toEqual(expect.objectContaining({
      kind: 'plugin',
      rendererId: 'design-studio.studio',
      implementationRuntime: 'react',
    }));
  });
});
