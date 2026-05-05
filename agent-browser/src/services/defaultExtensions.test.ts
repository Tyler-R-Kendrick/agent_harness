import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EXTENSION_MANIFESTS,
  DEFAULT_EXTENSION_MARKETPLACE,
  DEFAULT_EXTENSION_MARKETPLACES,
  createDefaultExtensionRuntime,
} from './defaultExtensions';

describe('default extensions', () => {
  it('defines the monorepo marketplace as the default marketplace source', () => {
    expect(DEFAULT_EXTENSION_MARKETPLACE.publisher.id).toBe('agent-harness');
    expect(DEFAULT_EXTENSION_MARKETPLACE.name).toBe('Agent Harness default marketplace');
    expect(DEFAULT_EXTENSION_MARKETPLACES).toEqual([DEFAULT_EXTENSION_MARKETPLACE]);
    expect(DEFAULT_EXTENSION_MARKETPLACE.plugins.some((plugin) => plugin.default === true)).toBe(false);
    expect(DEFAULT_EXTENSION_MANIFESTS.map((extension) => extension.manifest.id)).toEqual([
      'agent-harness.ext.agent-skills',
      'agent-harness.ext.agents-md',
      'agent-harness.ext.design-md',
      'agent-harness.ext.symphony',
      'agent-harness.ext.workflow-canvas',
      'agent-harness.ext.artifacts',
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
          source: { path: './local-model-connector/dist' },
          categories: expect.arrayContaining(['browser-extension']),
        },
        manifest: {
          capabilities: expect.arrayContaining([
            expect.objectContaining({ kind: 'asset', id: 'local-model-connector-extension' }),
          ]),
        },
      });
    expect(runtime.extensions.find((extension) => extension.manifest.id === 'agent-harness.ext.local-inference-daemon'))
      .toMatchObject({
        marketplace: {
          source: { path: './local-inference-daemon/dist' },
          categories: expect.arrayContaining(['model-provider', 'daemon']),
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
});
