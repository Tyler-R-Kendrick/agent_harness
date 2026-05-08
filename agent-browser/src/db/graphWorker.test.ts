import { describe, expect, it } from 'vitest';
import { createGraphKnowledgeWorkerRuntime } from './graphWorker';

describe('graphWorker', () => {
  it('handles the required offline graph worker lifecycle through typed messages', async () => {
    const worker = createGraphKnowledgeWorkerRuntime();

    await expect(worker.dispatch({ type: 'init', now: '2026-05-08T00:00:00.000Z' })).resolves.toMatchObject({
      type: 'initialized',
      status: 'ready',
    });
    await expect(worker.dispatch({ type: 'createSchema' })).resolves.toMatchObject({ type: 'schemaCreated' });
    await expect(worker.dispatch({ type: 'loadSampleMemory', now: '2026-05-08T00:01:00.000Z' })).resolves.toMatchObject({
      type: 'sampleMemoryLoaded',
    });

    const search = await worker.dispatch({ type: 'searchMemory', query: 'Kuzu-WASM PathRAG retrieval' });
    expect(search.type).toBe('memorySearched');
    if (search.type === 'memorySearched') {
      expect(search.result.entities.map((entity) => entity.canonicalName)).toContain('Kuzu-WASM');
      expect(search.result.paths.length).toBeGreaterThan(0);
    }

    const contextPack = await worker.dispatch({ type: 'buildContextPack', query: 'offline graph memory' });
    expect(contextPack.type).toBe('contextPackBuilt');
    if (contextPack.type === 'contextPackBuilt') {
      expect(contextPack.contextPack.text).toContain('HOT MEMORY');
    }

    await expect(worker.dispatch({ type: 'getMemoryStats' })).resolves.toMatchObject({
      type: 'memoryStatsLoaded',
      stats: expect.objectContaining({ status: 'offline-ready' }),
    });
  });

  it('supports ingestion, retrieval modes, consolidation, import, export, and reset through one reducer boundary', async () => {
    const worker = createGraphKnowledgeWorkerRuntime();

    await worker.dispatch({ type: 'init', now: '2026-05-08T00:00:00.000Z' });
    await worker.dispatch({
      type: 'ingestText',
      input: {
        title: 'Offline PathRAG note',
        text: 'PathRAG connects Kuzu-WASM chunks to agent memories. Kuzu-WASM enables local graph traversal.',
        source: 'worker test',
        now: '2026-05-08T00:02:00.000Z',
      },
    });
    await worker.dispatch({
      type: 'ingestSkill',
      input: {
        name: 'Build graph memory worker',
        description: 'Keep database and retrieval work behind the worker boundary.',
        steps: ['Create schema', 'Ingest text', 'Search memory'],
        tools: ['Vitest'],
        now: '2026-05-08T00:03:00.000Z',
      },
    });

    for (const type of [
      'retrieveHotMemory',
      'retrieveLexical',
      'retrieveEntities',
      'retrievePaths',
      'retrieveByActivation',
      'retrieveCommunities',
      'retrieveTemporal',
      'retrieveProcedural',
    ] as const) {
      const response = await worker.dispatch({ type, query: 'Kuzu-WASM PathRAG worker memory' });
      expect(response.type).toMatch(/Retrieved$/);
    }

    const exported = await worker.dispatch({ type: 'exportMemory' });
    expect(exported.type).toBe('memoryExported');
    if (exported.type !== 'memoryExported') {
      throw new Error('Expected memoryExported response');
    }

    await expect(worker.dispatch({ type: 'resetDatabase', now: '2026-05-08T00:04:00.000Z' })).resolves.toMatchObject({
      type: 'databaseReset',
    });
    await expect(worker.dispatch({ type: 'importMemory', serialized: exported.serialized })).resolves.toMatchObject({
      type: 'memoryImported',
    });
    await expect(worker.dispatch({ type: 'consolidateMemory' })).resolves.toMatchObject({ type: 'memoryConsolidated' });
    await expect(worker.dispatch({ type: 'detectContradictions' })).resolves.toMatchObject({ type: 'contradictionsDetected' });
  });
});
