import { describe, expect, it } from 'vitest';
import {
  SAMPLE_MEMORY_TEXT,
  buildRagContext,
  createPersistentMemoryGraphState,
  exportPersistentMemoryGraph,
  importPersistentMemoryGraph,
  ingestTextToMemoryGraph,
  isPersistentMemoryGraphState,
  loadSampleMemoryGraph,
  retrievePathsForQuestion,
  runMemoryGraphQuery,
  searchPersistentMemoryGraph,
} from './persistentMemoryGraph';

describe('persistentMemoryGraph', () => {
  it('ingests text into a typed graph and retrieves prompt-ready path context', () => {
    const state = ingestTextToMemoryGraph(createPersistentMemoryGraphState('2026-05-08T00:00:00.000Z'), {
      title: 'Retrieval design notes',
      source: 'sample',
      text: 'Azure AI Search improves retrieval. Kuzu-WASM enables offline graph traversal. GraphRAG connects evidence to claims.',
      now: '2026-05-08T00:00:00.000Z',
    });

    const result = searchPersistentMemoryGraph(state, 'How does Kuzu-WASM help retrieval?', { maxPaths: 3 });

    expect(state.documents).toHaveLength(1);
    expect(state.chunks.length).toBeGreaterThan(0);
    expect(state.entities.map((entity) => entity.name)).toContain('Kuzu-WASM');
    expect(state.claims.map((claim) => claim.text).join(' ')).toContain('improves retrieval');
    expect(result.contextBlock).toContain('MEMORY SUMMARY');
    expect(result.contextBlock).toContain('Kuzu-WASM');
    expect(result.paths[0]?.explanation).toMatch(/matched/i);
    expect(result.subgraph.nodes.some((node) => node.label === 'Kuzu-WASM')).toBe(true);
  });

  it('loads sample memory with offline GraphRAG and PathRAG evidence', () => {
    const state = loadSampleMemoryGraph('2026-05-08T01:00:00.000Z');
    const result = searchPersistentMemoryGraph(state, 'offline graph retrieval with Kuzu-WASM', { maxPaths: 4 });

    expect(SAMPLE_MEMORY_TEXT).toContain('Kuzu-WASM');
    expect(state.documents[0]?.title).toBe('Enterprise AI graph memory architecture');
    expect(state.relationships.map((relationship) => relationship.type)).toEqual(expect.arrayContaining([
      'HAS_CHUNK',
      'MENTIONS',
      'SUPPORTS',
      'ABOUT',
      'DERIVED_FROM',
      'CONNECTS',
    ]));
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.entities.map((entity) => entity.name)).toEqual(expect.arrayContaining(['Kuzu-WASM', 'GraphRAG']));
    expect(result.paths.length).toBeGreaterThan(0);
    expect(result.contextBlock).toContain('RELEVANT PATHS');
  });

  it('runs supported graph-style queries and returns table plus graph-shaped data', () => {
    const state = loadSampleMemoryGraph('2026-05-08T01:00:00.000Z');

    const chunkQuery = runMemoryGraphQuery(state, 'MATCH (d:Document)-[:HAS_CHUNK]->(c:Chunk) RETURN d.title, c.id, c.text;');
    const mentionQuery = runMemoryGraphQuery(state, 'MATCH (c:Chunk)-[:MENTIONS]->(e:Entity) RETURN c.id, c.text, e.name, e.type;');

    expect(chunkQuery.columns).toEqual(['d.title', 'c.id', 'c.text']);
    expect(chunkQuery.rows.length).toBeGreaterThan(0);
    expect(mentionQuery.columns).toEqual(['c.id', 'c.text', 'e.name', 'e.type']);
    expect(mentionQuery.graph.nodes.length).toBeGreaterThan(0);
    expect(mentionQuery.graph.edges.length).toBeGreaterThan(0);
  });

  it('exports, imports, validates, and resets graph memory state safely', () => {
    const state = loadSampleMemoryGraph('2026-05-08T01:00:00.000Z');
    const serialized = exportPersistentMemoryGraph(state);
    const imported = importPersistentMemoryGraph(serialized);

    expect(isPersistentMemoryGraphState(imported)).toBe(true);
    expect(imported.documents).toEqual(state.documents);
    expect(searchPersistentMemoryGraph(imported, 'PathRAG').paths.length).toBeGreaterThan(0);
    expect(() => importPersistentMemoryGraph('{bad json')).toThrow(/Invalid memory graph JSON/);
    expect(isPersistentMemoryGraphState({ documents: [] })).toBe(false);
  });

  it('builds compact context and ranked paths independently from search', () => {
    const state = loadSampleMemoryGraph('2026-05-08T01:00:00.000Z');
    const paths = retrievePathsForQuestion(state, 'Why does local persistence improve offline workflows?', {
      maxDepth: 3,
      maxPaths: 2,
    });
    const result = searchPersistentMemoryGraph(state, 'Why does local persistence improve offline workflows?', {
      maxDepth: 3,
      maxPaths: 2,
    });
    const context = buildRagContext(result);

    expect(paths).toHaveLength(2);
    expect(paths[0].score).toBeGreaterThanOrEqual(paths[1].score);
    expect(paths[0].nodes.length).toBeGreaterThan(1);
    expect(context).toContain('RELEVANT EVIDENCE');
    expect(context).toContain('CLAIMS');
    expect(context).toContain('RELEVANT PATHS');
  });
});
