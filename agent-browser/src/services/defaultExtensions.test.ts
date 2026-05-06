import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EXTENSION_MANIFESTS,
  DEFAULT_EXTENSION_MARKETPLACE,
  DEFAULT_EXTENSION_MARKETPLACES,
  createDefaultExtensionRuntime,
  getExtensionMarketplaceCategory,
  getInstalledDefaultExtensionDescriptors,
  groupDefaultExtensionsByMarketplaceCategory,
} from './defaultExtensions';

describe('default extensions', () => {
  it('defines the monorepo marketplace as the default marketplace source', () => {
    expect(DEFAULT_EXTENSION_MARKETPLACE.publisher.id).toBe('agent-harness');
    expect(DEFAULT_EXTENSION_MARKETPLACE.name).toBe('Agent Harness default marketplace');
    expect(DEFAULT_EXTENSION_MARKETPLACES).toEqual([DEFAULT_EXTENSION_MARKETPLACE]);
    expect(DEFAULT_EXTENSION_MARKETPLACE.plugins.some((plugin) => plugin.default === true)).toBe(false);
    const grouped = groupDefaultExtensionsByMarketplaceCategory(DEFAULT_EXTENSION_MANIFESTS);
    expect(grouped.ide).toEqual(expect.arrayContaining([
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.design-md' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.workflow-canvas' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.artifacts' }) }),
    ]));
    expect(grouped.harness).toEqual(expect.arrayContaining([
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.agent-skills' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.agents-md' }) }),
    ]));
    expect(grouped.daemon).toEqual(expect.arrayContaining([
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.local-inference-daemon' }) }),
    ]));
    expect(grouped.provider).toEqual(expect.arrayContaining([
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.ghcp-model-provider' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.cursor-model-provider' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.codex-model-provider' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.codi-browser-model-provider' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.local-model-connector' }) }),
    ]));
    expect(grouped.runtime).toEqual(expect.arrayContaining([
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'agent-harness.ext.symphony' }) }),
    ]));
    expect(DEFAULT_EXTENSION_MANIFESTS.map((extension) => extension.manifest.id)).toEqual([
      'agent-harness.ext.agent-skills',
      'agent-harness.ext.agents-md',
      'agent-harness.ext.design-md',
      'agent-harness.ext.symphony',
      'agent-harness.ext.workflow-canvas',
      'agent-harness.ext.artifacts',
      'agent-harness.ext.ghcp-model-provider',
      'agent-harness.ext.cursor-model-provider',
      'agent-harness.ext.codex-model-provider',
      'agent-harness.ext.codi-browser-model-provider',
      'agent-harness.ext.local-model-connector',
      'agent-harness.ext.local-inference-daemon',
    ]);
  });

  it('keeps repo marketplace extensions installable without loading plugins by default', async () => {
    const runtime = await createDefaultExtensionRuntime([]);

    expect(runtime.extensions.map((extension) => extension.manifest.name)).toEqual([
      'Agent skills',
      'AGENTS.md workspace instructions',
      'DESIGN.md design tokens',
      'Symphony workflow orchestration',
      'Workflow canvas orchestration',
      'Artifacts',
      'GitHub Copilot Models',
      'Cursor Models',
      'Codex Models',
      'Codi Browser Models',
      'Local Model Connector',
      'Local Inference Daemon',
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
        'agent-harness.ext.artifacts',
      ],
    });

    expect(runtime.installedExtensionIds).toEqual([
      'agent-harness.ext.symphony',
      'agent-harness.ext.workflow-canvas',
      'agent-harness.ext.artifacts',
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
          manifest: './daemon/local-inference-daemon/agent-harness.plugin.json',
          source: { path: './daemon/local-inference-daemon/dist' },
          categories: expect.arrayContaining(['daemon-extension']),
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
        'agent-harness.ext.design-md',
        'agent-harness.ext.agents-md',
        'agent-harness.ext.symphony',
      ],
    });

    const installed = getInstalledDefaultExtensionDescriptors(runtime);

    expect(installed.map((extension) => extension.manifest.id)).toEqual([
      'agent-harness.ext.agents-md',
      'agent-harness.ext.design-md',
      'agent-harness.ext.symphony',
    ]);
    expect(installed.map(getExtensionMarketplaceCategory)).toEqual([
      'harness',
      'ide',
      'runtime',
    ]);
  });
});
