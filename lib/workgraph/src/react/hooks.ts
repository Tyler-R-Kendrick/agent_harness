import { useSyncExternalStore } from 'react';
import type { WorkGraph } from '../commands/command-bus.js';
import type { WorkGraphCommand, WorkGraphProjectionState } from '../core/types.js';

export interface WorkGraphExternalStore {
  dispatch(command: WorkGraphCommand): Promise<{ id: string; aggregateId: string }>;
  getSnapshot(): WorkGraphProjectionState;
  subscribe(listener: () => void): () => void;
}

export function createWorkGraphExternalStore(graph: WorkGraph): WorkGraphExternalStore {
  return {
    dispatch(command) {
      return graph.dispatch(command);
    },
    getSnapshot() {
      return graph.getSnapshot();
    },
    subscribe(listener) {
      return graph.observe(listener);
    },
  };
}

export function useWorkGraphState(store: WorkGraphExternalStore): WorkGraphProjectionState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
