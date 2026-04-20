import { describe, expect, it } from 'vitest';
import type { WorkspaceFile } from '../types';
import {
  WORKSPACE_DRIVE_NAME,
  buildMountedTerminalDriveNodes,
  buildWorkspaceCapabilityDriveNodes,
} from './virtualFilesystemTree';

describe('virtualFilesystemTree', () => {
  it('mounts workspace root files under a workspace drive and top-level directories as separate drives', () => {
    const files: WorkspaceFile[] = [
      { path: 'AGENTS.md', content: '# Rules', updatedAt: '2026-04-15T00:00:00.000Z' },
      { path: '.agents/skill/review-pr/SKILL.md', content: '---\nname: review-pr\n---', updatedAt: '2026-04-15T00:00:00.000Z' },
      { path: 'docs/plan.md', content: '# Plan', updatedAt: '2026-04-15T00:00:00.000Z' },
    ];

    const drives = buildWorkspaceCapabilityDriveNodes('file:ws-research', files);

    expect(drives.map((node) => ({ name: node.name, isDrive: node.isDrive }))).toEqual([
      { name: WORKSPACE_DRIVE_NAME, isDrive: true },
      { name: '//.agents', isDrive: true },
      { name: '//docs', isDrive: true },
    ]);

    expect(drives[0].children).toEqual([
      expect.objectContaining({ name: 'AGENTS.md', type: 'file', filePath: 'AGENTS.md' }),
    ]);

    expect(drives[1].children).toEqual([
      expect.objectContaining({
        name: 'skill',
        type: 'folder',
        children: [
          expect.objectContaining({
            name: 'review-pr',
            type: 'folder',
            children: [
              expect.objectContaining({ name: 'SKILL.md', type: 'file', filePath: '.agents/skill/review-pr/SKILL.md' }),
            ],
          }),
        ],
      }),
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

    expect(drives[0].children).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '.keep', type: 'file' }),
      expect.objectContaining({ name: 'notes.txt', type: 'file' }),
    ]));
    expect(drives[1].children).toEqual([
      expect.objectContaining({ name: 'cache', type: 'folder' }),
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
      expect.objectContaining({ name: 'AGENTS.md', type: 'file', filePath: 'AGENTS.md' }),
    ]);
  });

  it('does not set filePath on leaf file nodes without workspace:// content', () => {
    const paths = ['/workspace/notes.txt'];
    const fileContents = { '/workspace/notes.txt': 'plain text content' };
    const drives = buildMountedTerminalDriveNodes('vfs:ws-research:terminal-5', paths, fileContents);

    expect(drives[0].children).toEqual([
      expect.objectContaining({ name: 'notes.txt', type: 'file' }),
    ]);
    expect(drives[0].children?.[0]).not.toHaveProperty('filePath');
  });

  it('preserves directory nodes that have child files', () => {
    const paths = ['/workspace/docs', '/workspace/docs/README.md'];
    const drives = buildMountedTerminalDriveNodes('vfs:ws-research:terminal-6', paths);

    expect(drives[0].children).toEqual([
      expect.objectContaining({
        name: 'docs',
        type: 'folder',
        children: [
          expect.objectContaining({ name: 'README.md', type: 'file' }),
        ],
      }),
    ]);
  });
});