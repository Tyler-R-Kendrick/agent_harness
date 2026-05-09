import { describe, expect, it } from 'vitest';
import type { TreeNode, WorkspaceFile } from '../types';
import {
  buildRepoWikiPromptContext,
  buildRepoWikiSnapshot,
  isRepoWikiSnapshotsByWorkspace,
  searchRepoWikiSnapshot,
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
    expect(snapshot.pages.map((page) => page.id)).toEqual([
      'wiki:ws-research:workspace-map',
      'wiki:ws-research:capability-files',
      'wiki:ws-research:runtime-surfaces',
    ]);
    expect(snapshot.pages[0]).toMatchObject({
      title: 'Repo map',
      citationId: 'wiki:ws-research:workspace-map',
      body: [
        'Research is organized around 4 stored workspace files, 1 browser page, and 1 active session.',
        'The generated wiki links this orientation page to capability files and runtime surfaces so repository context can be navigated instead of read as flat notes.',
      ],
    });
    expect(snapshot.pages[0]?.links).toContainEqual(expect.objectContaining({
      targetId: 'wiki:ws-research:capability-files',
      targetTitle: 'Capability files',
      predicate: 'linksTo',
    }));
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

  it('models wiki pages, graph relationships, and isolated source chunks from repository evidence', () => {
    const snapshot = buildRepoWikiSnapshot({
      workspace,
      files: [
        ...workspaceFiles,
        {
          path: 'notes/orientation.md',
          content: 'Capability files and runtime surfaces need follow-up links.',
          updatedAt: '2026-05-07T00:00:00.000Z',
        },
        {
          path: 'docs/unlinked-research.md',
          content: 'A standalone note with no modeled relationships yet.',
          updatedAt: '2026-05-07T00:00:00.000Z',
        },
      ],
      refreshedAt: '2026-05-07T00:00:00.000Z',
    });

    expect(snapshot.knowledgeModel.graphModes).toMatchObject({
      globalNodeCount: 14,
      localFocusId: 'wiki:ws-research:workspace-map',
      localDepth: 2,
    });
    expect(snapshot.knowledgeModel.nodes.map((node) => node.id)).toContain(
      'source:docs/unlinked-research.md',
    );
    expect(snapshot.knowledgeModel.nodes.slice(0, 8).map((node) => node.id)).toEqual([
      'wiki:ws-research:workspace-map',
      'wiki:ws-research:capability-files',
      'wiki:ws-research:runtime-surfaces',
      'tag:orientation',
      'tag:capability',
      'tag:runtime',
      'source:workspace-files',
      'source:runtime-surfaces',
    ]);
    expect(snapshot.knowledgeModel.links).toContainEqual(expect.objectContaining({
      from: 'wiki:ws-research:workspace-map',
      to: 'wiki:ws-research:capability-files',
      kind: 'wikilink',
      predicate: 'linksTo',
      directed: true,
    }));
    expect(snapshot.knowledgeModel.links).toContainEqual(expect.objectContaining({
      from: 'source:workspace-files',
      to: 'wiki:ws-research:workspace-map',
      kind: 'provenance',
      predicate: 'prov:wasDerivedFrom',
    }));
    expect(snapshot.knowledgeModel.links).toContainEqual(expect.objectContaining({
      from: 'source:notes/orientation.md',
      to: 'wiki:ws-research:capability-files',
      kind: 'mention',
      predicate: 'mentions',
    }));
    expect(snapshot.knowledgeModel.nodes.find((node) => node.id === 'source:docs/unlinked-research.md')).toMatchObject({
      label: 'docs/unlinked-research.md',
      isIsolated: true,
      inbound: 0,
      outbound: 0,
    });
    expect(snapshot.knowledgeModel.groups.map((group) => group.id)).toEqual([
      'orientation',
      'capability',
      'runtime',
      'provenance',
    ]);
    expect(snapshot.knowledgeModel.unlinkedMentions).toContainEqual(expect.objectContaining({
      mention: 'Capability files',
      sourcePath: 'notes/orientation.md',
      targetId: 'wiki:ws-research:capability-files',
    }));
    expect(snapshot.knowledgeModel.canvas.cards[0]).toMatchObject({
      id: 'card:wiki:ws-research:workspace-map',
      nodeId: 'wiki:ws-research:workspace-map',
      kind: 'note',
      x: 80,
      y: 80,
    });
  });

  it('turns memory architecture patterns into a merged stored-memory model users can manage', () => {
    const snapshot = buildRepoWikiSnapshot({
      workspace,
      files: [
        ...workspaceFiles,
        {
          path: '.memory/session.memory.md',
          content: '# Session Memory\n\n- Follow-up should start from the repository wiki search bar',
          updatedAt: '2026-05-07T00:00:00.000Z',
        },
      ],
      refreshedAt: '2026-05-07T00:00:00.000Z',
    });

    expect(snapshot.managedMemory.summary).toBe('2 stored memories are available across prompt, graph, wiki, and session retrieval.');
    expect(snapshot.managedMemory.entries).toContainEqual(expect.objectContaining({
      id: '.memory/session.memory.md:3',
      scope: 'session',
      text: 'Follow-up should start from the repository wiki search bar',
      activationTier: 'hot',
      retrievalModes: ['prompt-snapshot', 'session-search', 'graph-rag', 'wiki-search'],
      sourcePath: '.memory/session.memory.md',
      lineNumber: 3,
    }));
    expect(snapshot.managedMemory.instructions.some((instruction) => instruction.includes('New memories are written as scoped markdown factoids'))).toBe(true);
    expect(snapshot.managedMemory.architectureSourcePaths).toContain('agent-browser/src/services/graphKnowledge.ts');
  });

  it('searches generated wiki pages, graph nodes, and stored memories from one scoped search index', () => {
    const snapshot = buildRepoWikiSnapshot({
      workspace,
      files: [
        ...workspaceFiles,
        {
          path: '.memory/session.memory.md',
          content: '# Session Memory\n\n- Follow-up should start from the repository wiki search bar',
          updatedAt: '2026-05-07T00:00:00.000Z',
        },
      ],
      refreshedAt: '2026-05-07T00:00:00.000Z',
    });

    expect(searchRepoWikiSnapshot(snapshot, 'search bar').map((result) => result.kind)).toEqual([
      'memory',
      'page',
      'graph',
    ]);
    expect(searchRepoWikiSnapshot(snapshot, 'capability').map((result) => result.title)).toContain('Capability files');
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
    expect(context).toContain('Wiki pages: Repo map, Capability files, Runtime surfaces');
    expect(context).toContain('Graph: 12 nodes, 13 relationships');
    expect(context).toContain('Stored memories: 1');
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
    expect(isRepoWikiSnapshotsByWorkspace({ 'ws-research': { ...snapshot, managedMemory: { entries: [{}] } } })).toBe(false);
    expect(isRepoWikiSnapshotsByWorkspace([{ 'ws-research': snapshot }])).toBe(false);
  });
});
