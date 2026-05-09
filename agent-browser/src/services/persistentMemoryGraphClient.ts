import {
  createPersistentMemoryGraphState,
  type MemoryGraphIngestInput,
  type MemoryGraphQueryResult,
  type MemoryGraphRetrievalOptions,
  type MemoryGraphRetrievalResult,
  type PersistentMemoryGraphState,
} from './persistentMemoryGraph.ts';
import {
  handlePersistentMemoryGraphRequest,
  type PersistentMemoryGraphWorkerRequest,
} from './persistentMemoryGraphWorker.ts';

export interface PersistentMemoryGraphClient {
  getState(): PersistentMemoryGraphState;
  init(): Promise<PersistentMemoryGraphState>;
  loadSampleMemory(now?: string): Promise<PersistentMemoryGraphState>;
  ingestText(input: MemoryGraphIngestInput): Promise<PersistentMemoryGraphState>;
  searchMemory(question: string, options?: MemoryGraphRetrievalOptions): Promise<MemoryGraphRetrievalResult>;
  runQuery(query: string): Promise<MemoryGraphQueryResult>;
  exportMemory(): Promise<string>;
  importMemory(serialized: string): Promise<PersistentMemoryGraphState>;
  resetDatabase(now?: string): Promise<PersistentMemoryGraphState>;
}

export function createPersistentMemoryGraphClient(initialState = createPersistentMemoryGraphState()): PersistentMemoryGraphClient {
  let state = initialState;
  let nextRequestId = 0;

  async function request<T>(input: Record<string, unknown> & { type: PersistentMemoryGraphWorkerRequest['type'] }): Promise<T> {
    nextRequestId += 1;
    const response = await handlePersistentMemoryGraphRequest(state, {
      ...input,
      id: `memory-graph:${nextRequestId}`,
    } as PersistentMemoryGraphWorkerRequest);
    state = response.state;
    if (!response.ok) {
      throw new Error(response.error ?? 'Persistent memory graph worker request failed.');
    }
    return response.payload as T;
  }

  return {
    getState: () => clonePersistentMemoryGraphState(state),
    init: () => request<PersistentMemoryGraphState>({ type: 'init' }),
    loadSampleMemory: (now) => request<PersistentMemoryGraphState>({ type: 'loadSampleMemory', now }),
    ingestText: (input) => request<PersistentMemoryGraphState>({ type: 'ingestText', input }),
    searchMemory: (question, options) => request<MemoryGraphRetrievalResult>({ type: 'searchMemory', question, options }),
    runQuery: (query) => request<MemoryGraphQueryResult>({ type: 'runQuery', query }),
    exportMemory: () => request<string>({ type: 'exportMemory' }),
    importMemory: (serialized) => request<PersistentMemoryGraphState>({ type: 'importMemory', serialized }),
    resetDatabase: (now) => request<PersistentMemoryGraphState>({ type: 'resetDatabase', now }),
  };
}

function clonePersistentMemoryGraphState(state: PersistentMemoryGraphState): PersistentMemoryGraphState {
  return structuredClone(state) as PersistentMemoryGraphState;
}
