import { describe, expect, it } from 'vitest';
import { createHarnessExtensionContext } from 'harness-core';

import {
  ARTIFACT_BUNDLE_MEDIA_TYPE,
  createArtifactsPlugin,
  decodeArtifactBundle,
  encodeArtifactBundle,
  ArtifactRenderer,
} from './index.js';

describe('artifacts extension plugin', () => {
  it('registers tools that create, update, list, and read multi-file artifacts through harness-core storage', async () => {
    const context = createHarnessExtensionContext({
      artifacts: undefined,
    });
    await context.plugins.load(createArtifactsPlugin({
      now: () => '2026-05-03T12:00:00.000Z',
    }));

    const created = await context.tools.execute('artifacts.create', {
      id: 'artifact-dashboard',
      title: 'Launch dashboard',
      kind: 'html',
      references: ['artifact-styleguide'],
      files: [
        { path: 'index.html', mediaType: 'text/html', content: '<main>Launch</main>' },
        { path: 'src/app.js', mediaType: 'text/javascript', content: 'console.log("launch")' },
      ],
    });
    const updated = await context.tools.execute('artifacts.update', {
      artifactId: 'artifact-dashboard',
      files: [{ path: 'index.html', content: '<main>Updated</main>' }],
    });
    const listed = await context.tools.execute('artifacts.list', {});
    const read = await context.tools.execute('artifacts.read', { id: 'artifact-dashboard' });

    expect(created).toMatchObject({
      id: 'artifact-dashboard',
      title: 'Launch dashboard',
      mediaType: ARTIFACT_BUNDLE_MEDIA_TYPE,
      files: [
        { path: 'index.html', mediaType: 'text/html' },
        { path: 'src/app.js', mediaType: 'text/javascript' },
      ],
      references: ['artifact-styleguide'],
    });
    expect(updated).toMatchObject({
      id: 'artifact-dashboard',
      files: [{ path: 'index.html', content: '<main>Updated</main>' }],
      references: ['artifact-styleguide'],
      versionCount: 1,
    });
    expect(listed).toEqual([expect.objectContaining({ id: 'artifact-dashboard', fileCount: 1, versionCount: 1 })]);
    expect(read).toMatchObject({
      id: 'artifact-dashboard',
      files: [{ path: 'index.html', content: '<main>Updated</main>' }],
      references: ['artifact-styleguide'],
      versionCount: 1,
    });
  });

  it('normalizes artifact bundles and rejects unsafe file paths', () => {
    const encoded = encodeArtifactBundle({
      kind: 'markdown',
      references: ['artifact-parent'],
      files: [{ path: 'README.md', mediaType: 'text/markdown', content: '# Readme' }],
    });

    expect(decodeArtifactBundle(encoded)).toEqual({
      kind: 'markdown',
      references: ['artifact-parent'],
      files: [{ path: 'README.md', mediaType: 'text/markdown', content: '# Readme' }],
    });
    expect(decodeArtifactBundle({
      kind: 42,
      references: 'artifact-parent',
      files: [{ path: 'README.md', content: '# Readme' }],
    } as unknown as ReturnType<typeof encodeArtifactBundle>)).toEqual({
      kind: 'bundle',
      references: [],
      files: [{ path: 'README.md', content: '# Readme' }],
    });
    expect(() => decodeArtifactBundle('null')).toThrow('Artifact bundle must be an object');
    expect(() => decodeArtifactBundle({
      files: 'README.md',
    } as unknown as ReturnType<typeof encodeArtifactBundle>)).toThrow('Artifacts need at least one file');
    expect(encodeArtifactBundle({
      files: [{ path: 'README.md', content: '# Readme' }],
    })).toEqual({
      kind: 'bundle',
      references: [],
      files: [{ path: 'README.md', content: '# Readme' }],
    });
    expect(() => encodeArtifactBundle({
      files: [{ path: '../README.md', content: 'nope' }],
    })).toThrow('Artifact file paths must be relative');
    expect(ArtifactRenderer()).toBeNull();
  });

  it('surfaces validation errors and empty non-string snapshots', async () => {
    const context = createHarnessExtensionContext();
    await context.plugins.load(createArtifactsPlugin());

    await expect(context.tools.execute('artifacts.create', { files: [] })).rejects.toThrow('Artifacts need at least one file');
    await expect(context.tools.execute('artifacts.create', { files: [{ path: 'README.md' }] })).rejects.toThrow('Artifact files need path and content');
    await expect(context.tools.execute('artifacts.read', {})).rejects.toThrow('Artifact id is required');
    await expect(context.tools.execute('artifacts.read', { id: 'artifact-missing' })).rejects.toThrow('Unknown artifact: artifact-missing');
    await expect(context.tools.execute('artifacts.update', {
      id: 'artifact-missing',
      files: [{ path: 'README.md', content: 'missing' }],
    })).rejects.toThrow('Unknown artifact: artifact-missing');
    const raw = await context.artifacts.create({ id: 'raw', data: new Uint8Array([1, 2, 3]) });

    await expect(context.tools.execute('artifacts.list', {})).resolves.toEqual([
      expect.objectContaining({ id: raw.id, fileCount: 0 }),
    ]);
    await expect(context.tools.execute('artifacts.read', { id: raw.id })).resolves.toMatchObject({
      id: raw.id,
      title: raw.id,
      mediaType: null,
      files: [],
    });
    await expect(context.tools.execute('artifacts.update', {
      id: raw.id,
      title: 'Raw artifact',
      kind: 'markdown',
      references: [' artifact-parent ', 'artifact-parent', 42],
      files: [{ path: 'README.md', content: '# Raw' }],
    })).resolves.toMatchObject({
      id: raw.id,
      title: 'Raw artifact',
      kind: 'markdown',
      references: ['artifact-parent'],
      versionCount: 1,
    });
    await expect(context.tools.execute('artifacts.update', {
      artifactId: raw.id,
      title: ' ',
      files: [{ path: 'README.md', content: '# Raw v2' }],
    })).resolves.toMatchObject({
      id: raw.id,
      title: raw.id,
      versionCount: 2,
    });
  });

  it('uses default bundle fields and lists artifacts without readable snapshots', async () => {
    const context = createHarnessExtensionContext();
    await context.plugins.load(createArtifactsPlugin());
    context.artifacts.registerRemote({ id: 'remote-empty', uri: 'artifact://remote-empty' });

    await expect(context.tools.execute('artifacts.read', { id: 'remote-empty' }))
      .rejects
      .toThrow('Unknown artifact: remote-empty');
    await expect(context.tools.execute('artifacts.update', {
      id: 'remote-empty',
      files: [{ path: 'README.md', content: 'remote' }],
    })).rejects.toThrow('Unknown artifact: remote-empty');
    await expect(context.tools.execute('artifacts.create', {
      id: ' ',
      title: ' ',
      kind: 42,
      references: [' artifact-parent ', 'artifact-parent', 42, ''],
      files: [{ path: ' src\\main.ts ', content: 'export const ok = true;' }],
    })).resolves.toMatchObject({
      kind: 'bundle',
      references: ['artifact-parent'],
      files: [{ path: 'src/main.ts', content: 'export const ok = true;' }],
    });
    await expect(context.tools.execute('artifacts.list', {})).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'remote-empty',
        title: 'remote-empty',
        mediaType: null,
        kind: 'bundle',
        fileCount: 0,
      }),
      expect.objectContaining({
        kind: 'bundle',
        references: ['artifact-parent'],
        fileCount: 1,
      }),
    ]));
  });

  it('registers a command for opening a new artifact drafting prompt', async () => {
    const context = createHarnessExtensionContext();
    await context.plugins.load(createArtifactsPlugin());

    expect(context.commands.list().map((command) => command.id)).toContain('artifacts.new');
    await expect(context.commands.execute('/artifact Launch dashboard')).resolves.toMatchObject({
      matched: true,
      commandId: 'artifacts.new',
      result: {
        type: 'prompt',
        prompt: expect.stringContaining('Create or update an artifact named "Launch dashboard"'),
      },
    });
    await expect(context.commands.execute('/artifact')).resolves.toMatchObject({
      matched: true,
      commandId: 'artifacts.new',
      result: {
        type: 'prompt',
        prompt: expect.stringContaining('Create or update an artifact named "Untitled artifact"'),
      },
    });
  });
});
