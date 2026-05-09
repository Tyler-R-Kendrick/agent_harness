import { describe, expect, it } from 'vitest';
import { createPersistentMemoryGraphClient } from './persistentMemoryGraphClient';
import { handlePersistentMemoryGraphRequest } from './persistentMemoryGraphWorker';

describe('persistentMemoryGraph worker boundary', () => {
  it('handles init, sample load, search, export, import, and reset through typed requests', async () => {
    const client = createPersistentMemoryGraphClient();

    await client.loadSampleMemory();
    const search = await client.searchMemory('offline graph retrieval');
    expect(search.contextBlock).toContain('MEMORY SUMMARY');

    const exported = await client.exportMemory();
    await client.resetDatabase();
    expect((await client.searchMemory('Kuzu-WASM')).entities).toHaveLength(0);

    await client.importMemory(exported);
    expect((await client.searchMemory('Kuzu-WASM')).entities.length).toBeGreaterThan(0);
  });

  it('keeps returned graph snapshots isolated from future client requests', async () => {
    const client = createPersistentMemoryGraphClient();

    const loadedState = await client.loadSampleMemory('2026-05-09T00:00:00.000Z');
    const originalTitle = loadedState.documents[0]!.title;
    loadedState.documents[0]!.title = 'mutated through returned state payload';

    expect(client.getState().documents[0]?.title).toBe(originalTitle);

    const stateSnapshot = client.getState();
    stateSnapshot.documents[0]!.title = 'mutated through getState snapshot';

    expect(client.getState().documents[0]?.title).toBe(originalTitle);

    const searchResult = await client.searchMemory('Kuzu-WASM graph retrieval');
    searchResult.chunks[0]!.text = 'mutated through search payload';

    expect(client.getState().chunks[0]?.text).not.toBe('mutated through search payload');
  });

  it('returns typed errors for invalid imports without losing existing graph state', async () => {
    let state = (await handlePersistentMemoryGraphRequest(undefined, { id: '1', type: 'loadSampleMemory' })).state;
    const response = await handlePersistentMemoryGraphRequest(state, {
      id: '2',
      type: 'importMemory',
      serialized: '{bad json',
    });

    expect(response.ok).toBe(false);
    expect(response.id).toBe('2');
    expect(response.error).toMatch(/Invalid memory graph JSON/);
    state = response.state;
    expect(state.documents.length).toBeGreaterThan(0);
  });
});
