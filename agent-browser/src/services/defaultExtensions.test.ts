import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EXTENSION_MANIFESTS,
  DEFAULT_EXTENSION_MARKETPLACE,
  createDefaultExtensionRuntime,
} from './defaultExtensions';

describe('default extensions', () => {
  it('loads the monorepo extension manifests and packages by default', async () => {
    expect(DEFAULT_EXTENSION_MARKETPLACE.publisher.id).toBe('agent-harness');
    expect(DEFAULT_EXTENSION_MANIFESTS.map((extension) => extension.manifest.id)).toEqual([
      'agent-harness.ext.agent-skills',
      'agent-harness.ext.agents-md',
      'agent-harness.ext.design-md',
      'agent-harness.ext.symphony',
      'agent-harness.ext.workflow-canvas',
      'agent-harness.ext.artifacts',
      'agent-harness.ext.local-model-connector',
    ]);

    const runtime = await createDefaultExtensionRuntime([]);

    expect(runtime.extensions.map((extension) => extension.manifest.name)).toEqual([
      'Agent skills',
      'AGENTS.md workspace instructions',
      'DESIGN.md design tokens',
      'Symphony workflow orchestration',
      'Workflow canvas orchestration',
      'Artifacts',
      'Local Model Connector',
    ]);
    expect(runtime.plugins.map((plugin) => plugin.id)).toEqual([
      'agent-skills',
      'agents-md',
      'design-md',
      'symphony',
      'workflow-canvas',
      'artifacts',
      'local-model-connector',
    ]);
    expect(runtime.hooks.map((hook) => hook.id)).toEqual([
      'agents-md',
      'design-md.semantic-guidance',
      'symphony.workflow-md',
    ]);
    expect(runtime.commands.some((command) => command.id === 'agent-skills')).toBe(true);
    expect(runtime.tools.map((tool) => tool.id)).toContain('design-md.apply');
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
  });
});
