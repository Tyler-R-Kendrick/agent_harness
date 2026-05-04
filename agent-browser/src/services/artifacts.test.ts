import { describe, expect, it } from 'vitest';

import {
  ARTIFACTS_DRIVE_NAME,
  buildArtifactPromptContext,
  createArtifact,
  createArtifactDownloadPayload,
  createArtifactVersion,
  isArtifactsByWorkspace,
  resolveArtifactContext,
  updateArtifactFiles,
  type AgentArtifact,
} from './artifacts';

const now = '2026-05-03T12:00:00.000Z';

describe('artifacts', () => {
  it('creates multi-file artifacts with references and version history metadata', () => {
    const artifact = createArtifact({
      id: 'artifact-dashboard',
      title: 'Launch dashboard',
      description: 'A live planning dashboard.',
      kind: 'html',
      sourceSessionId: 'session-1',
      references: ['artifact-styleguide'],
      files: [
        { path: 'index.html', mediaType: 'text/html', content: '<main>Launch</main>' },
        { path: 'src/app.js', mediaType: 'text/javascript', content: 'console.log("launch")' },
      ],
    }, { now: () => now });

    expect(artifact).toMatchObject({
      id: 'artifact-dashboard',
      title: 'Launch dashboard',
      kind: 'html',
      sourceSessionId: 'session-1',
      createdAt: now,
      updatedAt: now,
      references: ['artifact-styleguide'],
      files: [
        { path: 'index.html', mediaType: 'text/html' },
        { path: 'src/app.js', mediaType: 'text/javascript' },
      ],
      versions: [],
    });

    expect(isArtifactsByWorkspace({ 'ws-build': [artifact] })).toBe(true);
    expect(isArtifactsByWorkspace({ 'ws-build': [{ ...artifact, files: [] }] })).toBe(false);
  });

  it('updates files by preserving the prior artifact revision as a restorable version', () => {
    const artifact = createArtifact({
      id: 'artifact-copy',
      title: 'Copy draft',
      files: [{ path: 'copy.md', mediaType: 'text/markdown', content: '# First' }],
    }, { now: () => '2026-05-03T12:00:00.000Z' });

    const updated = updateArtifactFiles(artifact, {
      files: [{ path: 'copy.md', mediaType: 'text/markdown', content: '# Second' }],
    }, {
      now: () => '2026-05-03T12:05:00.000Z',
      idFactory: () => 'version-1',
    });

    expect(updated.updatedAt).toBe('2026-05-03T12:05:00.000Z');
    expect(updated.files[0].content).toBe('# Second');
    expect(updated.versions).toEqual([
      createArtifactVersion(artifact, {
        id: 'version-1',
        createdAt: '2026-05-03T12:05:00.000Z',
      }),
    ]);
  });

  it('resolves attached artifact context with referenced artifacts in dependency order', () => {
    const styleguide = createArtifact({
      id: 'artifact-styleguide',
      title: 'Style guide',
      files: [{ path: 'tokens.css', mediaType: 'text/css', content: ':root { --accent: teal; }' }],
    }, { now: () => now });
    const dashboard = createArtifact({
      id: 'artifact-dashboard',
      title: 'Launch dashboard',
      references: [styleguide.id],
      files: [{ path: 'index.html', mediaType: 'text/html', content: '<link rel="stylesheet" href="tokens.css">' }],
    }, { now: () => now });

    const resolved = resolveArtifactContext([dashboard, styleguide], [dashboard.id]);
    const promptContext = buildArtifactPromptContext([dashboard, styleguide], [dashboard.id]);

    expect(resolved.map((artifact) => artifact.id)).toEqual(['artifact-styleguide', 'artifact-dashboard']);
    expect(promptContext).toContain('Active artifacts mounted at //artifacts');
    expect(promptContext).toContain(`${ARTIFACTS_DRIVE_NAME}/artifact-styleguide/tokens.css`);
    expect(promptContext).toContain(`${ARTIFACTS_DRIVE_NAME}/artifact-dashboard/index.html`);
    expect(promptContext).toContain('References: artifact-styleguide');
    expect(promptContext).toContain(':root { --accent: teal; }');
  });

  it('creates direct downloads for single-file artifacts and zip downloads for bundles', () => {
    const single = createArtifact({
      id: 'artifact-notes',
      title: 'Notes',
      files: [{ path: 'notes.md', mediaType: 'text/markdown', content: '# Notes' }],
    }, { now: () => now });
    const bundle = createArtifact({
      id: 'artifact-site',
      title: 'Launch Site',
      files: [
        { path: 'index.html', mediaType: 'text/html', content: '<h1>Launch</h1>' },
        { path: 'assets/app.css', mediaType: 'text/css', content: 'h1 { color: teal; }' },
      ],
    }, { now: () => now });

    const singleDownload = createArtifactDownloadPayload(single);
    const bundleDownload = createArtifactDownloadPayload(bundle);

    expect(singleDownload).toEqual({
      fileName: 'notes.md',
      mediaType: 'text/markdown',
      data: '# Notes',
      kind: 'file',
    });
    expect(bundleDownload.kind).toBe('zip');
    expect(bundleDownload.fileName).toBe('launch-site.zip');
    expect(bundleDownload.mediaType).toBe('application/zip');
    expect(bundleDownload.data).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(bundleDownload.data as Uint8Array)).toContain('index.html');
    expect(new TextDecoder().decode(bundleDownload.data as Uint8Array)).toContain('assets/app.css');
  });

  it('rejects unsafe paths and unresolved references', () => {
    const artifact: AgentArtifact = {
      id: 'artifact-a',
      title: 'Unsafe',
      createdAt: now,
      updatedAt: now,
      files: [{ path: '../secrets.txt', content: 'nope', mediaType: 'text/plain' }],
      references: [],
      versions: [],
    };

    expect(isArtifactsByWorkspace({ 'ws-build': [artifact] })).toBe(false);
    expect(() => resolveArtifactContext([{
      ...artifact,
      files: [{ path: 'safe.txt', content: 'ok', mediaType: 'text/plain' }],
      references: ['missing'],
    }], ['artifact-a'])).toThrow('Unknown artifact reference: missing');
  });
});
