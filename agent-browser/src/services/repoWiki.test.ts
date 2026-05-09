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

  it('models wiki memory using Obsidian-style links plus RDF, SKOS, PROV, and canvas metadata', () => {
    const snapshot = buildRepoWikiSnapshot({
      workspace,
      files: [
        ...workspaceFiles,
        {
          path: 'notes/orientation.md',
          content: 'Capability files and runtime surfaces need follow-up links.',
          updatedAt: '2026-05-07T00:00:00.000Z',
        },
      ],
      refreshedAt: '2026-05-07T00:00:00.000Z',
    });

    expect(snapshot.knowledgeModel.standards).toEqual([
      'Obsidian wikilinks/backlinks/properties',
      'RDF triples',
      'SKOS concept groups',
      'PROV provenance',
      'JSON Canvas layout',
    ]);
    expect(snapshot.knowledgeModel.graphModes).toMatchObject({
      globalNodeCount: 8,
      localFocusId: 'wiki:ws-research:workspace-map',
      localDepth: 2,
    });
    expect(snapshot.knowledgeModel.nodes.map((node) => node.id)).toEqual([
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

  it('aggregates competitor memory patterns into one harness architecture roadmap', () => {
    const snapshot = buildRepoWikiSnapshot({
      workspace,
      files: workspaceFiles,
      refreshedAt: '2026-05-07T00:00:00.000Z',
    });

    expect(snapshot.memoryArchitecture.designGoal).toContain('one harness memory stack');
    expect(snapshot.memoryArchitecture.layers.map((layer) => layer.id)).toEqual([
      'prompt-snapshot',
      'session-search',
      'graph-rag',
      'wiki-vault',
      'procedural-skills',
      'activation-tiers',
      'provider-adapters',
    ]);
    expect(snapshot.memoryArchitecture.layers[0]).toMatchObject({
      title: 'Hermes-style prompt snapshot',
      inspiration: 'Hermes Agent MEMORY.md/USER.md',
      retrievalMode: 'always injected, bounded, curated',
    });
    expect(snapshot.memoryArchitecture.layers.find((layer) => layer.id === 'graph-rag')).toMatchObject({
      title: 'GraphRAG / PathRAG retrieval',
      storage: 'typed local graph with paths, claims, facts, events, communities, and hot memory blocks',
    });
    expect(snapshot.memoryArchitecture.layers.find((layer) => layer.id === 'procedural-skills')?.capabilities).toContain(
      'convert successful workflows and corrections into reusable skills',
    );
    expect(snapshot.memoryArchitecture.gaps).toContain(
      'Add a pluggable provider seam so external semantic stores augment, not replace, the core prompt snapshot.',
    );
    expect(snapshot.memoryArchitecture.roadmap.map((item) => item.phase)).toEqual([
      'Foundation',
      'Retrieval',
      'Learning loop',
      'Provider bridge',
    ]);
    expect(snapshot.memoryArchitecture.sourcePaths).toEqual([
      'reference_impl/features/workspace-model/decisions/ADR-002-four-tier-memory-model.md',
      'docs/superpowers/plans/2026-04-24-workspace-memory.md',
      'docs/superpowers/plans/2026-05-08-graph-knowledge.md',
      'docs/superpowers/plans/2026-05-08-persistent-memory-graphs.md',
      'harness-core/src/memory.ts',
      'agent-browser/src/services/workspaceMemory.ts',
      'agent-browser/src/services/graphKnowledge.ts',
      'agent-browser/src/services/persistentMemoryGraph.ts',
      'ext/harness/agent-skills/examples/default-workspace-skills/memory/SKILL.md',
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
    expect(context).toContain('Memory model: Obsidian wikilinks/backlinks/properties, RDF triples, SKOS concept groups, PROV provenance, JSON Canvas layout');
    expect(context).toContain('Memory architectures: prompt-snapshot, session-search, graph-rag, wiki-vault, procedural-skills, activation-tiers, provider-adapters');
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
    expect(isRepoWikiSnapshotsByWorkspace({ 'ws-research': { ...snapshot, memoryArchitecture: { layers: [] } } })).toBe(false);
    expect(isRepoWikiSnapshotsByWorkspace([{ 'ws-research': snapshot }])).toBe(false);
  });
});
