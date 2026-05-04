import { describe, expect, it } from 'vitest';

import {
  EXTERNAL_PLUGIN_MANIFEST_LOCATIONS,
  importExternalPluginManifest,
  importExternalPluginMarketplaceManifest,
  validateHarnessPluginManifest,
  validateHarnessPluginMarketplaceManifest,
} from '../index.js';

describe('external plugin manifest compatibility', () => {
  it('imports GitHub Copilot CLI plugins with all documented component paths', () => {
    const manifest = importExternalPluginManifest({
      ecosystem: 'github-copilot',
      manifest: {
        name: 'my-dev-tools',
        description: 'React development utilities',
        version: '1.2.0',
        author: { name: 'Jane Doe', email: 'jane@example.com' },
        license: 'MIT',
        keywords: ['react', 'frontend'],
        agents: 'agents/',
        skills: ['skills/', 'extra-skills/'],
        commands: 'commands/',
        hooks: 'hooks.json',
        mcpServers: '.mcp.json',
        lspServers: 'lsp.json',
      },
    });

    expect(EXTERNAL_PLUGIN_MANIFEST_LOCATIONS['github-copilot'].plugin).toEqual([
      '.plugin/plugin.json',
      'plugin.json',
      '.github/plugin/plugin.json',
      '.claude-plugin/plugin.json',
    ]);
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      id: 'github-copilot.plugin.my-dev-tools',
      sourceFormat: 'github-copilot',
      name: 'my-dev-tools',
      version: '1.2.0',
      components: {
        agents: ['agents/'],
        skills: ['skills/', 'extra-skills/'],
        commands: ['commands/'],
        hooks: ['hooks.json'],
        mcpServers: ['.mcp.json'],
        lspServers: ['lsp.json'],
      },
    });
    expect(manifest.capabilities?.map((capability) => capability.kind)).toEqual([
      'chat-agent',
      'skill',
      'command',
      'hook',
      'mcp-server',
      'lsp-server',
    ]);
    expect(validateHarnessPluginManifest(manifest)).toEqual({ success: true, issues: [] });
  });

  it('imports Claude Code plugins, including output styles, themes, monitors, bins, settings, dependencies, and defaults', () => {
    const manifest = importExternalPluginManifest({
      ecosystem: 'claude-code',
      directoryName: 'enterprise-tools',
      manifest: {
        name: 'enterprise-tools',
        description: 'Enterprise workflow automation tools',
        version: '2.1.0',
        commands: ['./commands/core/', './commands/preview.md'],
        agents: ['./agents/security-reviewer.md'],
        skills: './skills',
        outputStyles: './output-styles',
        themes: './themes',
        monitors: './monitors/monitors.json',
        hooks: { PostToolUse: [{ matcher: 'Write|Edit', hooks: [] }] },
        mcpServers: { 'enterprise-db': { command: '${CLAUDE_PLUGIN_ROOT}/servers/db-server' } },
        lspServers: '.lsp.json',
        dependencies: ['audit-tools'],
        userConfig: { properties: { endpoint: { type: 'string' } } },
        channels: ['stable', 'beta'],
        bin: './bin',
        settings: './settings.json',
      },
    });

    expect(EXTERNAL_PLUGIN_MANIFEST_LOCATIONS['claude-code'].plugin).toEqual(['.claude-plugin/plugin.json']);
    expect(manifest).toMatchObject({
      id: 'claude-code.plugin.enterprise-tools',
      sourceFormat: 'claude-code',
      components: {
        commands: ['./commands/core/', './commands/preview.md'],
        agents: ['./agents/security-reviewer.md'],
        skills: ['./skills'],
        outputStyles: ['./output-styles'],
        themes: ['./themes'],
        monitors: ['./monitors/monitors.json'],
        hooks: [{ inline: { PostToolUse: [{ matcher: 'Write|Edit', hooks: [] }] } }],
        mcpServers: [{ inline: { 'enterprise-db': { command: '${CLAUDE_PLUGIN_ROOT}/servers/db-server' } } }],
        lspServers: ['.lsp.json'],
        bins: ['./bin'],
        settings: ['./settings.json'],
      },
      metadata: {
        dependencies: ['audit-tools'],
        userConfig: { properties: { endpoint: { type: 'string' } } },
        channels: ['stable', 'beta'],
      },
    });
    expect(manifest.capabilities?.map((capability) => capability.kind)).toContain('output-style');
    expect(manifest.capabilities?.map((capability) => capability.kind)).toContain('monitor');
    expect(validateHarnessPluginManifest(manifest).success).toBe(true);

    const defaulted = importExternalPluginManifest({
      ecosystem: 'claude-code',
      directoryName: 'raw-plugin',
    });
    expect(defaulted.components).toMatchObject({
      skills: ['skills/'],
      commands: ['commands/'],
      agents: ['agents/'],
      outputStyles: ['output-styles/'],
      themes: ['themes/'],
      monitors: ['monitors/monitors.json'],
      hooks: ['hooks/hooks.json'],
      mcpServers: ['.mcp.json'],
      lspServers: ['.lsp.json'],
      bins: ['bin/'],
      settings: ['settings.json'],
    });
  });

  it('imports Pi package manifests and conventional package layouts', () => {
    const manifest = importExternalPluginManifest({
      ecosystem: 'pi',
      packageJson: {
        name: '@acme/pi-media-tools',
        description: 'Pi package for media tools',
        version: '0.3.0',
        keywords: ['pi-package'],
        pi: {
          extensions: ['./extensions', '!./extensions/legacy.ts'],
          skills: ['./skills'],
          prompts: ['./prompts'],
          themes: ['./themes'],
          image: 'https://example.com/screenshot.png',
          video: 'https://example.com/demo.mp4',
        },
      },
    });

    expect(EXTERNAL_PLUGIN_MANIFEST_LOCATIONS.pi.plugin).toEqual(['package.json']);
    expect(manifest).toMatchObject({
      id: 'pi.package.acme-pi-media-tools',
      sourceFormat: 'pi',
      components: {
        extensions: ['./extensions', '!./extensions/legacy.ts'],
        skills: ['./skills'],
        prompts: ['./prompts'],
        themes: ['./themes'],
      },
      metadata: {
        gallery: {
          image: 'https://example.com/screenshot.png',
          video: 'https://example.com/demo.mp4',
        },
      },
    });
    expect(manifest.capabilities?.map((capability) => capability.kind)).toEqual([
      'extension',
      'skill',
      'prompt',
      'theme',
      'renderer',
    ]);
    expect(validateHarnessPluginManifest(manifest)).toEqual({ success: true, issues: [] });

    const conventional = importExternalPluginManifest({
      ecosystem: 'pi',
      packageJson: { name: 'simple-pi-pack' },
    });
    expect(conventional.components).toMatchObject({
      extensions: ['extensions/'],
      skills: ['skills/'],
      prompts: ['prompts/'],
      themes: ['themes/'],
    });
    expect(importExternalPluginManifest({
      ecosystem: 'pi',
      packageJson: {
        name: 'skills-only',
        pi: { skills: ['./skills'] },
      },
    }).capabilities?.map((capability) => capability.kind)).toEqual(['skill']);

    expect(importExternalPluginManifest({
      ecosystem: 'pi',
      packageJson: { name: '!!!' },
    }).id).toBe('pi.package.package');
  });

  it('imports Copilot and Claude marketplace manifests with git, npm, and strict-mode metadata', () => {
    const copilot = importExternalPluginMarketplaceManifest({
      ecosystem: 'github-copilot',
      manifest: {
        name: 'my-marketplace',
        owner: { name: 'Your Organization', email: 'plugins@example.com' },
        metadata: { description: 'Curated plugins', version: '1.0.0' },
        plugins: [{
          name: 'frontend-design',
          description: 'Create GUI assets',
          version: '2.1.0',
          source: 'plugins/frontend-design',
          skills: 'skills/',
          strict: false,
          category: 'design',
          keywords: ['ui'],
        }, {
          name: 'local-object',
          source: {
            path: 'plugins/local-object',
          },
        }, {
          source: 'plugins/unnamed',
        }],
      },
    });
    const claude = importExternalPluginMarketplaceManifest({
      ecosystem: 'claude-code',
      manifest: {
        name: 'company-tools',
        owner: { name: 'Company' },
        plugins: [{
          name: 'designer',
          source: {
            source: 'git-subdir',
            url: 'owner/repo',
            path: 'plugins/designer',
            ref: 'v2.0.0',
            sha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
          },
          commands: ['./commands'],
          hooks: { PostToolUse: [] },
          strict: false,
        }, {
          name: 'npm-tools',
          source: {
            source: 'npm',
            package: '@acme/claude-plugin',
            version: '^2.0.0',
            registry: 'https://npm.example.com',
          },
        }, {
          name: 'github-tools',
          source: {
            source: 'github',
            repo: 'company/github-tools',
            ref: 'main',
            sha: 'b1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b1',
          },
        }, {
          name: 'git-tools',
          source: {
            source: 'url',
            url: 'https://gitlab.example.com/team/tools.git',
            ref: 'stable',
            sha: 'c1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b2',
          },
        }, {
          name: 'local-object-tools',
          source: {
            source: 'local',
            path: './plugins/local-object-tools',
          },
        }],
      },
    });

    expect(copilot).toMatchObject({
      schemaVersion: 1,
      name: 'my-marketplace',
      publisher: { id: 'your-organization', name: 'Your Organization' },
      plugins: [{
        id: 'github-copilot.plugin.frontend-design',
        sourceFormat: 'github-copilot',
        manifest: './plugins/frontend-design/plugin.json',
        source: { type: 'local', path: 'plugins/frontend-design' },
        strict: false,
        components: { skills: ['skills/'] },
        categories: ['design'],
        keywords: ['ui'],
      }, {
        id: 'github-copilot.plugin.local-object',
        sourceFormat: 'github-copilot',
        manifest: './plugins/local-object/plugin.json',
        source: { type: 'local', path: 'plugins/local-object' },
      }, {
        id: 'github-copilot.plugin.plugin',
        sourceFormat: 'github-copilot',
        manifest: './plugins/unnamed/plugin.json',
        source: { type: 'local', path: 'plugins/unnamed' },
      }],
    });
    expect(validateHarnessPluginMarketplaceManifest(copilot)).toEqual({ success: true, issues: [] });
    expect(claude.plugins).toEqual([
      expect.objectContaining({
        id: 'claude-code.plugin.designer',
        sourceFormat: 'claude-code',
        manifest: './plugins/designer/.claude-plugin/plugin.json',
        source: {
          type: 'git-subdir',
          url: 'owner/repo',
          path: 'plugins/designer',
          ref: 'v2.0.0',
          sha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
        },
        components: {
          commands: ['./commands'],
          hooks: [{ inline: { PostToolUse: [] } }],
        },
        strict: false,
      }),
      expect.objectContaining({
        id: 'claude-code.plugin.npm-tools',
        source: {
          type: 'npm',
          package: '@acme/claude-plugin',
          version: '^2.0.0',
          registry: 'https://npm.example.com',
        },
      }),
      expect.objectContaining({
        id: 'claude-code.plugin.github-tools',
        source: {
          type: 'github',
          repo: 'company/github-tools',
          ref: 'main',
          sha: 'b1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b1',
        },
      }),
      expect.objectContaining({
        id: 'claude-code.plugin.git-tools',
        source: {
          type: 'git',
          url: 'https://gitlab.example.com/team/tools.git',
          ref: 'stable',
          sha: 'c1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b2',
        },
      }),
      expect.objectContaining({
        id: 'claude-code.plugin.local-object-tools',
        source: {
          type: 'local',
          path: './plugins/local-object-tools',
        },
      }),
    ]);
    expect(validateHarnessPluginMarketplaceManifest(claude).success).toBe(true);
  });

  it('handles sparse external manifests without inventing unavailable components', () => {
    const unnamedCopilot = importExternalPluginManifest({
      ecosystem: 'github-copilot',
      directoryName: 'dir-plugin',
    });
    const copilot = importExternalPluginManifest({
      ecosystem: 'github-copilot',
      manifest: {
        name: '',
        version: '',
        description: '',
        hooks: null,
        skills: 'skills/',
      },
    });
    const marketplace = importExternalPluginMarketplaceManifest({
      ecosystem: 'github-copilot',
      manifest: {
        owner: [],
        plugins: [{
          name: 'default-source',
          source: {
            repo: 'company/default-source',
          },
        }],
      },
    });
    const emptyMarketplace = importExternalPluginMarketplaceManifest({
      ecosystem: 'github-copilot',
      manifest: {
        owner: { name: 'Empty' },
      },
    });
    const manifestOnlyPi = importExternalPluginManifest({
      ecosystem: 'pi',
      manifest: { name: 'manifest-pi', pi: { prompts: ['./prompts'] } },
    });
    const directoryPi = importExternalPluginManifest({
      ecosystem: 'pi',
      directoryName: 'directory-pi',
    });
    const fallbackPi = importExternalPluginManifest({
      ecosystem: 'pi',
    });

    expect(unnamedCopilot.id).toBe('github-copilot.plugin.dir-plugin');
    expect(copilot).toMatchObject({
      id: 'github-copilot.plugin.copilot-plugin',
      name: 'copilot-plugin',
      version: '0.0.0',
      description: 'Imported GitHub Copilot plugin copilot-plugin.',
      components: { skills: ['skills/'] },
    });
    expect(marketplace).toMatchObject({
      publisher: { id: 'imported-marketplace', name: 'Imported marketplace' },
      name: 'imported-marketplace',
      plugins: [{
        id: 'github-copilot.plugin.default-source',
        source: { type: 'local' },
      }],
    });
    expect(emptyMarketplace.plugins).toEqual([]);
    expect(importExternalPluginMarketplaceManifest({
      ecosystem: 'claude-code',
      manifest: {
        name: 'default-source-marketplace',
        plugins: [{
          name: 'default-github-source',
          source: { repo: 'company/default-github-source' },
        }],
      },
    }).plugins[0].source).toEqual({ type: 'github', repo: 'company/default-github-source' });
    expect(manifestOnlyPi.components).toEqual({ prompts: ['./prompts'] });
    expect(directoryPi.name).toBe('directory-pi');
    expect(fallbackPi.name).toBe('pi-package');
  });
});
