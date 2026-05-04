import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  HARNESS_PLUGIN_MANIFEST_FILENAME,
  HARNESS_PLUGIN_MARKETPLACE_MANIFEST_FILENAME,
  createPluginHookEvent,
  createPluginHookPoint,
  parseHarnessPluginManifest,
  parseHarnessPluginMarketplaceManifest,
  validateHarnessPluginManifest,
  validateHarnessPluginMarketplaceManifest,
} from '../index.js';

const pluginManifest = {
  schemaVersion: 1,
  id: 'agent-harness.ext.agents-md',
  name: 'AGENTS.md workspace instructions',
  version: '0.1.0',
  description: 'Loads AGENTS.md files as an optional prompt-context plugin.',
  entrypoint: {
    module: './src/index.ts',
    export: 'createAgentsMdHookPlugin',
  },
  capabilities: [
    {
      kind: 'hook',
      id: 'agents-md',
      event: { type: 'plugin', name: 'agent-harness.ext.agents-md.before-llm-messages' },
      description: 'Prepends selected AGENTS.md instructions before model inference.',
    },
  ],
  events: [
    {
      type: 'plugin',
      name: 'agent-harness.ext.agents-md.before-llm-messages',
      description: 'Runs before LLM message preparation when this plugin is loaded.',
    },
  ],
  assets: [
    {
      kind: 'example',
      path: './examples/basic/AGENTS.md',
      description: 'Minimal AGENTS.md plugin asset example.',
    },
  ],
  permissions: [
    {
      scope: 'workspace-files',
      access: 'read',
      reason: 'Reads user-selected workspace instruction files.',
    },
  ],
  compatibility: {
    harnessCore: '^0.1.0',
  },
};

const marketplaceManifest = {
  schemaVersion: 1,
  name: 'Agent Harness extension examples',
  publisher: {
    id: 'agent-harness',
    name: 'Agent Harness',
  },
  plugins: [
    {
      id: 'agent-harness.ext.agents-md',
      name: 'AGENTS.md workspace instructions',
      version: '0.1.0',
      description: 'Loads AGENTS.md files as an optional prompt-context plugin.',
      manifest: './agents-md/agent-harness.plugin.json',
      source: {
        type: 'local',
        path: './agents-md',
      },
      categories: ['workspace-context'],
      keywords: ['agents-md', 'instructions'],
    },
  ],
};

describe('plugin manifest standards', () => {
  it('defines canonical plugin and marketplace manifest filenames', () => {
    expect(HARNESS_PLUGIN_MANIFEST_FILENAME).toBe('agent-harness.plugin.json');
    expect(HARNESS_PLUGIN_MARKETPLACE_MANIFEST_FILENAME).toBe('agent-harness.marketplace.json');
  });

  it('validates plugin manifests for runtime-loaded extension assets', () => {
    const result = validateHarnessPluginManifest(pluginManifest);

    expect(result.success).toBe(true);
    expect(parseHarnessPluginManifest(pluginManifest)).toEqual(pluginManifest);
  });

  it('validates renderer and pane-item contributions in plugin manifests', () => {
    const manifest = {
      ...pluginManifest,
      capabilities: [
        ...pluginManifest.capabilities,
        { kind: 'renderer', id: 'media.pdf' },
        { kind: 'pane-item', id: 'design-md.designer-pane' },
      ],
      renderers: [{
        id: 'media.pdf',
        label: 'PDF viewer',
        target: {
          kind: 'file',
          fileExtensions: ['.pdf'],
          mimeTypes: ['application/pdf'],
        },
        component: {
          module: './src/PdfRenderer.tsx',
          export: 'PdfRenderer',
        },
      }],
      paneItems: [{
        id: 'design-md.designer-pane',
        label: 'Designer',
        rendererId: 'design-md.designer',
        preferredLocation: 'side',
        when: {
          kind: 'file',
          fileNames: ['DESIGN.md'],
        },
        component: {
          module: './src/DesignerPane.tsx',
          export: 'DesignerPane',
        },
      }],
    };

    expect(validateHarnessPluginManifest(manifest)).toEqual({ success: true, issues: [] });
    expect(validateHarnessPluginManifest({
      ...manifest,
      renderers: [{ ...manifest.renderers[0], component: { module: '../PdfRenderer.tsx' } }],
    }).issues).toContain('Renderer modules must be relative paths inside the plugin package.');
    expect(validateHarnessPluginManifest({
      ...manifest,
      renderers: [{
        ...manifest.renderers[0],
        target: { kind: 'file', fileExtensions: ['pdf'] },
      }],
    }).issues).toContain('File extensions must include a leading dot.');
  });

  it('keeps the DESIGN.md example renderer manifest valid', () => {
    const manifest = JSON.parse(readFileSync(
      new URL('../../../ext/design-md/agent-harness.plugin.json', import.meta.url),
      'utf8',
    ));

    expect(validateHarnessPluginManifest(manifest)).toEqual({ success: true, issues: [] });
  });

  it('rejects built-in feature shortcuts and unsafe entrypoints in plugin manifests', () => {
    expect(validateHarnessPluginManifest({
      ...pluginManifest,
      entrypoint: undefined,
    }).issues).toContain('Harness plugin manifests require an entrypoint unless they import an external plugin format.');
    expect(validateHarnessPluginManifest({
      ...pluginManifest,
      id: 'AGENTS.md',
    }).issues).toContain('Plugin id must use reverse-DNS lowercase segments.');
    expect(validateHarnessPluginManifest({
      ...pluginManifest,
      entrypoint: { module: '../src/ext/agents-md.ts' },
    }).issues).toContain('Entrypoint module must be a relative path inside the plugin package.');
    expect(validateHarnessPluginManifest({
      ...pluginManifest,
      capabilities: [{ kind: 'agent-skill', id: 'legacy' }],
    }).issues).toContain('Capability kind "agent-skill" is not part of the core plugin standard.');
    expect(() => parseHarnessPluginManifest({
      ...pluginManifest,
      id: 'AGENTS.md',
    })).toThrow(/Invalid harness plugin manifest/);
  });

  it('validates marketplace manifests that point at plugin manifests', () => {
    expect(validateHarnessPluginMarketplaceManifest(marketplaceManifest)).toEqual({ success: true, issues: [] });
    expect(parseHarnessPluginMarketplaceManifest(marketplaceManifest)).toEqual(marketplaceManifest);
    expect(validateHarnessPluginMarketplaceManifest({
      ...marketplaceManifest,
      plugins: [{ ...marketplaceManifest.plugins[0], manifest: './agents-md/package.json' }],
    }).issues).toContain('Marketplace plugin entries must reference agent-harness.plugin.json manifests.');
    expect(() => parseHarnessPluginMarketplaceManifest({
      ...marketplaceManifest,
      plugins: [{ ...marketplaceManifest.plugins[0], manifest: './agents-md/package.json' }],
    })).toThrow(/Invalid harness plugin marketplace manifest/);
  });

  it('creates custom plugin hook events in the shared hook-point format', () => {
    const event = createPluginHookEvent('agent-harness.ext.agents-md', 'before-llm-messages');

    expect(event).toEqual({
      type: 'plugin',
      name: 'agent-harness.ext.agents-md.before-llm-messages',
    });
    expect(createPluginHookPoint('agent-harness.ext.agents-md', 'before-llm-messages')).toBe(
      'plugin:agent-harness.ext.agents-md.before-llm-messages',
    );
    expect(() => createPluginHookEvent('Bad Plugin', 'before-llm-messages')).toThrow(/reverse-DNS/);
    expect(() => createPluginHookEvent('agent-harness.ext.agents-md', 'Before LLM')).toThrow(/lowercase/);
  });
});
