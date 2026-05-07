import { describe, expect, it } from 'vitest';
import type { TreeNode, WorkspaceFile } from '../types';
import {
  buildRepoWikiPromptContext,
  buildRepoWikiSnapshot,
  isRepoWikiSnapshotsByWorkspace,
} from './repoWiki';

const workspace: TreeNode = {
  id: 'ws-research',
  name: 'Research',
  type: 'workspace',
  children: [
    {
      id: 'browser',
      name: 'Browser',
      type: 'folder',
      nodeKind: 'browser',
      children: [
        {
          id: 'tab-1',
          name: 'DeepWiki notes',
          type: 'tab',
          nodeKind: 'browser',
          url: 'https://example.test/deepwiki',
          memoryMB: 96,
        },
      ],
    },
    {
      id: 'sessions',
      name: 'Sessions',
      type: 'folder',
      nodeKind: 'session',
      children: [
        {
          id: 'session-1',
          name: 'Planning',
          type: 'tab',
          nodeKind: 'session',
        },
      ],
    },
  ],
};

const workspaceFiles: WorkspaceFile[] = [
  {
    path: '.memory/project.memory.md',
    content: '# Project memory\n- Durable repository orientation',
    updatedAt: '2026-05-07T00:00:00.000Z',
  },
  {
    path: '.agents/plugins/review/agent-harness.plugin.json',
    content: '{"name":"Review plugin","capabilities":[]}',
    updatedAt: '2026-05-07T00:00:00.000Z',
  },
  {
    path: '.agents/hooks/pre-review.sh',
    content: '#!/usr/bin/env bash\necho review',
    updatedAt: '2026-05-07T00:00:00.000Z',
  },
  {
    path: 'settings.json',
    content: '{"model":"codi"}',
    updatedAt: '2026-05-07T00:00:00.000Z',
  },
];

describe('repoWiki', () => {
  it('builds deterministic repo map sections, architecture diagrams, and citations', () => {
    const snapshot = buildRepoWikiSnapshot({
      workspace,
      files: workspaceFiles,
      refreshedAt: '2026-05-07T00:00:00.000Z',
    });

    expect(snapshot).toMatchObject({
      id: 'wiki:ws-research',
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      refreshedAt: '2026-05-07T00:00:00.000Z',
    });
    expect(snapshot.sections.map((section) => section.id)).toEqual([
      'workspace-map',
      'capability-files',
      'runtime-surfaces',
    ]);
    expect(snapshot.sourceCoverage).toEqual({
      workspaceFileCount: 4,
      browserPageCount: 1,
      sessionCount: 1,
      pluginCount: 1,
      hookCount: 1,
      memoryFileCount: 1,
      settingsFileCount: 1,
    });
    expect(snapshot.diagrams[0]).toMatchObject({
      id: 'workspace-runtime',
      title: 'Workspace runtime architecture',
    });
    expect(snapshot.diagrams[0]?.edges.map((edge) => `${edge.from}->${edge.to}`)).toContain(
      'Workspace files->Agent prompt context',
    );
    expect(snapshot.citations.map((citation) => citation.id)).toEqual([
      'wiki:ws-research:workspace-map',
      'wiki:ws-research:capability-files',
      'wiki:ws-research:runtime-surfaces',
    ]);
    expect(snapshot.citations[1]?.sourcePaths).toEqual([
      '.agents/hooks/pre-review.sh',
      '.agents/plugins/review/agent-harness.plugin.json',
      '.memory/project.memory.md',
      'settings.json',
    ]);
  });

  it('formats compact prompt context with stable citation IDs', () => {
    const snapshot = buildRepoWikiSnapshot({
      workspace,
      files: workspaceFiles,
      refreshedAt: '2026-05-07T00:00:00.000Z',
    });
    const context = buildRepoWikiPromptContext(snapshot);

    expect(context).toContain('Repository wiki: Research');
    expect(context).toContain('Source coverage: 4 files, 1 browser pages, 1 sessions');
    expect(context).toContain('Architecture views: Workspace runtime architecture');
    expect(context).toContain('Citations: wiki:ws-research:workspace-map, wiki:ws-research:capability-files, wiki:ws-research:runtime-surfaces');
  });

  it('validates persisted wiki snapshots by workspace', () => {
    const snapshot = buildRepoWikiSnapshot({
      workspace,
      files: workspaceFiles,
      refreshedAt: '2026-05-07T00:00:00.000Z',
    });

    expect(isRepoWikiSnapshotsByWorkspace({ 'ws-research': snapshot })).toBe(true);
    expect(isRepoWikiSnapshotsByWorkspace({ 'ws-research': { ...snapshot, citations: [{ id: 42 }] } })).toBe(false);
    expect(isRepoWikiSnapshotsByWorkspace([{ 'ws-research': snapshot }])).toBe(false);
  });
});
