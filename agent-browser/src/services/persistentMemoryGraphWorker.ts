import {
  createPersistentMemoryGraphState,
  exportPersistentMemoryGraph,
  importPersistentMemoryGraph,
  ingestTextToMemoryGraph,
  loadSampleMemoryGraph,
  runMemoryGraphQuery,
  searchPersistentMemoryGraph,
  type MemoryGraphIngestInput,
  type MemoryGraphQueryResult,
  type MemoryGraphRetrievalOptions,
  type MemoryGraphRetrievalResult,
  type PersistentMemoryGraphState,
} from './persistentMemoryGraph.ts';

export type PersistentMemoryGraphWorkerRequest =
  | { id: string; type: 'init' }
  | { id: string; type: 'loadSampleMemory'; now?: string }
  | { id: string; type: 'ingestText'; input: MemoryGraphIngestInput }
  | { id: string; type: 'searchMemory'; question: string; options?: MemoryGraphRetrievalOptions }
  | { id: string; type: 'runQuery'; query: string }
  | { id: string; type: 'exportMemory' }
  | { id: string; type: 'importMemory'; serialized: string }
  | { id: string; type: 'resetDatabase'; now?: string };

export type PersistentMemoryGraphWorkerPayload =
  | PersistentMemoryGraphState
  | MemoryGraphRetrievalResult
  | MemoryGraphQueryResult
  | string;

export interface PersistentMemoryGraphWorkerResponse {
  id: string;
  ok: boolean;
  state: PersistentMemoryGraphState;
  payload?: PersistentMemoryGraphWorkerPayload;
  error?: string;
}

export async function handlePersistentMemoryGraphRequest(
  currentState: PersistentMemoryGraphState | undefined,
  request: PersistentMemoryGraphWorkerRequest,
): Promise<PersistentMemoryGraphWorkerResponse> {
  const state = currentState ?? createPersistentMemoryGraphState();
  try {
    switch (request.type) {
      case 'init':
        return ok(request.id, state, state);
      case 'loadSampleMemory': {
        const nextState = loadSampleMemoryGraph(request.now);
        return ok(request.id, nextState, nextState);
      }
      case 'ingestText': {
        const nextState = ingestTextToMemoryGraph(state, request.input);
        return ok(request.id, nextState, nextState);
      }
      case 'searchMemory':
        return ok(request.id, state, searchPersistentMemoryGraph(state, request.question, request.options));
      case 'runQuery':
        return ok(request.id, state, runMemoryGraphQuery(state, request.query));
      case 'exportMemory':
        return ok(request.id, state, exportPersistentMemoryGraph(state));
      case 'importMemory': {
        const nextState = importPersistentMemoryGraph(request.serialized);
        return ok(request.id, nextState, nextState);
      }
      case 'resetDatabase': {
        const nextState = createPersistentMemoryGraphState(request.now);
        return ok(request.id, nextState, nextState);
      }
    }
  } catch (error) {
    return {
      id: request.id,
      ok: false,
      state: cloneWorkerValue(state),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function ok(
  id: string,
  state: PersistentMemoryGraphState,
  payload: PersistentMemoryGraphWorkerPayload,
): PersistentMemoryGraphWorkerResponse {
  return { id, ok: true, state: cloneWorkerValue(state), payload: cloneWorkerValue(payload) };
}

function cloneWorkerValue<T extends PersistentMemoryGraphState | PersistentMemoryGraphWorkerPayload>(value: T): T {
  return structuredClone(value) as T;
}
