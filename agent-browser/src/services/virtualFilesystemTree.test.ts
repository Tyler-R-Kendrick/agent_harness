import { describe, expect, it } from 'vitest';
import type { WorkspaceFile } from '../types';
import {
  ARTIFACTS_DRIVE_NAME,
  WORKSPACE_DRIVE_NAME,
  buildArtifactDriveNodes,
  buildArtifactWorktreeNodes,
  buildInstalledExtensionDriveNodes,
  buildMountedTerminalDriveNodes,
  buildWorkspaceCapabilityDriveNodes,
} from './virtualFilesystemTree';
import { createArtifact } from './artifacts';
import type { DefaultExtensionDescriptor } from './defaultExtensions';

describe('virtualFilesystemTree', () => {
  it('mounts installed harness extensions as a virtual extensions drive', () => {
    const extensions = [
      {
        marketplace: {
          id: 'agent-harness.ext.agent-skills',
          name: 'Agent skills',
          version: '0.1.0',
          description: 'Loads skills.',
          source: { type: 'local', path: './harness/agent-skills' },
          metadata: { marketplaceCategory: 'harness' },
        },
        manifest: {
          schemaVersion: 1,
          id: 'agent-harness.ext.agent-skills',
          name: 'Agent skills',
          version: '0.1.0',
          description: 'Loads skills.',
          entrypoint: { module: './src/index.ts' },
        },
      },
      {
        marketplace: {
          id: 'agent-harness.ext.open-design',
          name: 'OpenDesign DESIGN.md Studio',
          version: '0.1.0',
          description: 'Visual design system studio.',
          source: { type: 'local', path: './ide/open-design' },
          metadata: { marketplaceCategory: 'ide' },
        },
        manifest: {
          schemaVersion: 1,
          id: 'agent-harness.ext.open-design',
          name: 'OpenDesign DESIGN.md Studio',
          version: '0.1.0',
          description: 'Visual design system studio.',
          entrypoint: { module: './src/index.ts' },
        },
      },
    ] as DefaultExtensionDescriptor[];

    const drives = buildInstalledExtensionDriveNodes('extensions:ws-build', extensions);

    expect(drives).toEqual([
      expect.objectContaining({
        id: 'extensions:ws-build:drive:extensions',
        name: '//extensions',
        type: 'folder',
        isDrive: true,
        children: [
          expect.objectContaining({
            name: 'harness',
            children: [
              expect.objectContaining({
                name: 'Agent skills',
                children: [
                  expect.objectContaining({ name: 'manifest.json', type: 'file' }),
                ],
              }),
            ],
          }),
          expect.objectContaining({
            name: 'ide',
            children: [
              expect.objectContaining({
                name: 'OpenDesign DESIGN.md Studio',
                children: [
                  expect.objectContaining({ name: 'manifest.json', type: 'file' }),
                ],
              }),
            ],
          }),
        ],
      }),
    ]);
  });

  it('mounts artifacts as their own special drive with files and references', () => {
    const styleguide = createArtifact({
      id: 'artifact-styleguide',
      title: 'Style guide',
      files: [{ path: 'tokens.css', mediaType: 'text/css', content: ':root {}' }],
    }, { now: () => '2026-05-03T12:00:00.000Z' });
    const dashboard = createArtifact({
      id: 'artifact-dashboard',
      title: 'Launch dashboard',
      references: [styleguide.id],
      files: [
        { path: 'index.html', mediaType: 'text/html', content: '<main></main>' },
        { path: 'src/app.js', mediaType: 'text/javascript', content: 'console.log("launch")' },
      ],
    }, { now: () => '2026-05-03T12:00:00.000Z' });

    const drives = buildArtifactDriveNodes('artifact:ws-build', [dashboard, styleguide]);

    expect(drives).toHaveLength(1);
    expect(drives[0]).toMatchObject({
      id: 'artifact:ws-build:drive:artifacts',
      name: ARTIFACTS_DRIVE_NAME,
      type: 'folder',
      isDrive: true,
      expanded: false,
    });
    expect(drives[0].children).toEqual([
      expect.objectContaining({
        id: 'artifact:ws-build:artifact:artifact-dashboard',
        name: 'Launch dashboard',
        artifactId: 'artifact-dashboard',
        children: [
          expect.objectContaining({ name: 'References', type: 'folder' }),
          expect.objectContaining({
            name: 'src',
            type: 'folder',
            children: [
              expect.objectContaining({ name: 'app.js', type: 'file', artifactId: 'artifact-dashboard', artifactFilePath: 'src/app.js' }),
            ],
          }),
          expect.objectContaining({ name: 'index.html', type: 'file', artifactId: 'artifact-dashboard', artifactFilePath: 'index.html' }),
        ],
      }),
      expect.objectContaining({
        id: 'artifact:ws-build:artifact:artifact-styleguide',
        name: 'Style guide',
      }),
    ]);
    expect(drives[0].children?.[0].children?.[0]).toEqual(expect.objectContaining({
      name: 'References',
      children: [
        expect.objectContaining({
          name: 'Style guide',
          type: 'file',
          artifactId: 'artifact-styleguide',
          artifactReferenceId: 'artifact-styleguide',
          isReference: true,
        }),
      ],
    }));
  });

  it('builds artifact worktree nodes without an intermediate //artifacts drive', () => {
    const styleguide = createArtifact({
      id: 'artifact-styleguide',
      title: 'Style guide',
      files: [{ path: 'tokens.css', mediaType: 'text/css', content: ':root {}' }],
    }, { now: () => '2026-05-03T12:00:00.000Z' });
    const dashboard = createArtifact({
      id: 'artifact-dashboard',
      title: 'Launch dashboard',
      references: [styleguide.id],
      files: [
        { path: 'index.html', mediaType: 'text/html', content: '<main></main>' },
        { path: 'src/app.js', mediaType: 'text/javascript', content: 'console.log("launch")' },
      ],
    }, { now: () => '2026-05-03T12:00:00.000Z' });

    const nodes = buildArtifactWorktreeNodes('artifact:ws-build', [dashboard, styleguide]);

    expect(nodes).toEqual([
      expect.objectContaining({
        id: 'artifact:ws-build:artifact:artifact-dashboard',
        name: 'Launch dashboard',
        artifactId: 'artifact-dashboard',
        children: expect.arrayContaining([
          expect.objectContaining({ name: 'References', type: 'folder' }),
          expect.objectContaining({ name: 'index.html', type: 'file', artifactId: 'artifact-dashboard', artifactFilePath: 'index.html' }),
        ]),
      }),
      expect.objectContaining({
        id: 'artifact:ws-build:artifact:artifact-styleguide',
        name: 'Style guide',
      }),
    ]);
    expect(nodes.map((node) => node.name)).not.toContain(ARTIFACTS_DRIVE_NAME);
  });

  it('keeps hidden workspace folders under //workspace while mounting non-hidden top-level directories as separate drives', () => {
    const files: WorkspaceFile[] = [
      { path: 'AGENTS.md', content: '# Rules', updatedAt: '2026-04-15T00:00:00.000Z' },
      { path: '.agents/skills/review-pr/SKILL.md', content: '---\nname: review-pr\n---', updatedAt: '2026-04-15T00:00:00.000Z' },
      { path: 'docs/plan.md', content: '# Plan', updatedAt: '2026-04-15T00:00:00.000Z' },
    ];

    const drives = buildWorkspaceCapabilityDriveNodes('file:ws-research', files);

    expect(drives.map((node) => ({ name: node.name, isDrive: node.isDrive }))).toEqual([
      { name: WORKSPACE_DRIVE_NAME, isDrive: true },
      { name: '//docs', isDrive: true },
    ]);

    expect(drives[0].expanded).toBe(false);
    expect(drives[1].expanded).toBe(false);

    expect(drives[0].children).toEqual([
      expect.objectContaining({
        name: '.agents',
        type: 'folder',
        expanded: false,
        children: [
          expect.objectContaining({
            name: 'skills',
            type: 'folder',
            expanded: false,
            children: [
              expect.objectContaining({
                name: 'review-pr',
                type: 'folder',
                expanded: false,
                children: [
                  expect.objectContaining({ name: 'SKILL.md', type: 'file', filePath: '.agents/skills/review-pr/SKILL.md' }),
                ],
              }),
            ],
          }),
        ],
      }),
      expect.objectContaining({ name: 'AGENTS.md', type: 'file', filePath: 'AGENTS.md' }),
    ]);

    expect(drives[1].children).toEqual([
      expect.objectContaining({ name: 'plan.md', type: 'file', filePath: 'docs/plan.md' }),
    ]);
  });

  it('mounts top-level terminal directories as drives beneath each filesystem node', () => {
    const drives = buildMountedTerminalDriveNodes('vfs:ws-research:terminal-2', [
      '/workspace',
      '/workspace/.keep',
      '/workspace/notes.txt',
      '/tmp/cache',
    ]);

    expect(drives.map((node) => ({ name: node.name, isDrive: node.isDrive }))).toEqual([
      { name: 'workspace', isDrive: false },
      { name: 'tmp', isDrive: false },
    ]);

    expect(drives[0].expanded).toBe(false);
    expect(drives[1].expanded).toBe(false);

    expect(drives[0].children).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '.keep', type: 'file' }),
      expect.objectContaining({ name: 'notes.txt', type: 'file' }),
    ]));
    expect(drives[1].children).toEqual([
      expect.objectContaining({ name: 'cache', type: 'folder', expanded: false }),
    ]);
  });

  it('reuses existing terminal folders and keeps the workspace drive first', () => {
    const drives = buildMountedTerminalDriveNodes('vfs:ws-research:terminal-3', [
      '/',
      '/tmp/cache/a.txt',
      '/workspace/notes.txt',
      '/tmp/cache/b.txt',
    ]);

    expect(drives.map((node) => node.name)).toEqual([
      'workspace',
      'tmp',
    ]);
    expect(drives[1].children).toEqual([
      expect.objectContaining({
        name: 'cache',
        type: 'folder',
        expanded: false,
        children: expect.arrayContaining([
          expect.objectContaining({ name: 'a.txt', type: 'file' }),
          expect.objectContaining({ name: 'b.txt', type: 'file' }),
        ]),
      }),
    ]);
  });

  it('sets filePath on leaf file nodes whose content is a workspace:// symlink', () => {
    const paths = ['/workspace/AGENTS.md'];
    const fileContents = { '/workspace/AGENTS.md': 'workspace://AGENTS.md' };
    const drives = buildMountedTerminalDriveNodes('vfs:ws-research:terminal-4', paths, fileContents);

    expect(drives[0].children).toEqual([
      expect.objectContaining({ name: 'AGENTS.md', type: 'file', filePath: 'AGENTS.md', isReference: true }),
    ]);
  });

  it('treats session symlink content that targets a workspace drive path as a file reference', () => {
    const paths = ['/workspace/AGENTS.md'];
    const fileContents = { '/workspace/AGENTS.md': '-> //workspace/AGENTS.md' };
    const drives = buildMountedTerminalDriveNodes('vfs:ws-research:terminal-5', paths, fileContents);

    expect(drives[0].children).toEqual([
      expect.objectContaining({ name: 'AGENTS.md', type: 'file', filePath: 'AGENTS.md', isReference: true }),
    ]);
  });

  it('normalizes workspace-drive references for non-root drives', () => {
    const paths = ['/workspace/Plan.md'];
    const fileContents = { '/workspace/Plan.md': 'workspace:////docs/Plan.md' };
    const drives = buildMountedTerminalDriveNodes('vfs:ws-research:terminal-6', paths, fileContents);

    expect(drives[0].children).toEqual([
      expect.objectContaining({ name: 'Plan.md', type: 'file', filePath: 'docs/Plan.md', isReference: true }),
    ]);
  });

  it('ignores malformed empty workspace references', () => {
    const paths = ['/workspace/invalid.txt'];
    const fileContents = { '/workspace/invalid.txt': 'workspace:///' };
    const drives = buildMountedTerminalDriveNodes('vfs:ws-research:terminal-7', paths, fileContents);

    expect(drives[0].children).toEqual([
      expect.objectContaining({ name: 'invalid.txt', type: 'file' }),
    ]);
    expect(drives[0].children?.[0]).not.toHaveProperty('filePath');
  });

  it('does not set filePath on leaf file nodes without workspace:// content', () => {
    const paths = ['/workspace/notes.txt'];
    const fileContents = { '/workspace/notes.txt': 'plain text content' };
    const drives = buildMountedTerminalDriveNodes('vfs:ws-research:terminal-8', paths, fileContents);

    expect(drives[0].children).toEqual([
      expect.objectContaining({ name: 'notes.txt', type: 'file' }),
    ]);
    expect(drives[0].children?.[0]).not.toHaveProperty('filePath');
  });

  it('preserves directory nodes that have child files', () => {
    const paths = ['/workspace/docs', '/workspace/docs/README.md'];
    const drives = buildMountedTerminalDriveNodes('vfs:ws-research:terminal-9', paths);

    expect(drives[0].children).toEqual([
      expect.objectContaining({
        name: 'docs',
        type: 'folder',
        expanded: false,
        children: [
          expect.objectContaining({ name: 'README.md', type: 'file' }),
        ],
      }),
    ]);
  });
});
