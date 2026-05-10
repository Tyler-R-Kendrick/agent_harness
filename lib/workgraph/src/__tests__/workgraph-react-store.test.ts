import { describe, expect, it } from 'vitest';
import {
  createInMemoryWorkGraphRepository,
  createSequentialWorkGraphIdFactory,
  createWorkGraph,
  createWorkGraphExternalStore,
} from '../index.js';

describe('WorkGraph external store', () => {
  it('lets React hooks subscribe to projected state updates without mutating projections directly', async () => {
    const graph = createWorkGraph({
      repository: createInMemoryWorkGraphRepository(),
      ids: createSequentialWorkGraphIdFactory('store'),
    });
    const store = createWorkGraphExternalStore(graph);
    const seenEventCounts: number[] = [];
    const unsubscribe = store.subscribe(() => {
      seenEventCounts.push(store.getSnapshot().events.length);
    });

    await store.dispatch({
      type: 'workspace.create',
      actor: { type: 'user', id: 'user-1' },
      payload: { name: 'Subscribed workspace', key: 'SUB' },
    });
    unsubscribe();
    await store.dispatch({
      type: 'workspace.create',
      actor: { type: 'user', id: 'user-1' },
      payload: { name: 'Unobserved workspace', key: 'UNO' },
    });

    const snapshot = store.getSnapshot();
    expect(seenEventCounts).toEqual([1]);
    expect(Object.values(snapshot.workspaces).map((workspace) => workspace.key)).toEqual(['SUB', 'UNO']);
    expect(() => {
      (snapshot.workspaces['store-0001'] as { name: string }).name = 'mutated';
    }).toThrow(TypeError);
  });
});
