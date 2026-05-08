import {
  buildGraphKnowledgeContextPack,
  consolidateGraphKnowledge,
  createEmptyGraphKnowledgeState,
  exportGraphKnowledge,
  getGraphKnowledgeStats,
  importGraphKnowledge,
  ingestGraphKnowledgeSession,
  ingestGraphKnowledgeSkill,
  ingestGraphKnowledgeTaskTrace,
  ingestGraphKnowledgeText,
  loadSampleGraphKnowledge,
  promoteGraphKnowledgeToHotMemory,
  searchGraphKnowledge,
  type GraphKnowledgeState,
} from '../services/graphKnowledge';
import type { GraphKnowledgeWorkerRequest, GraphKnowledgeWorkerResponse } from './messages';

export interface GraphKnowledgeWorkerRuntime {
  getState(): GraphKnowledgeState;
  dispatch(request: GraphKnowledgeWorkerRequest): Promise<GraphKnowledgeWorkerResponse>;
}

export function createGraphKnowledgeWorkerRuntime(initialState = createEmptyGraphKnowledgeState()): GraphKnowledgeWorkerRuntime {
  let state = initialState;

  return {
    getState: () => state,
    async dispatch(request) {
      try {
        switch (request.type) {
          case 'init':
            state = createEmptyGraphKnowledgeState(request.now);
            return { type: 'initialized', status: 'ready', state };
          case 'createSchema':
            return { type: 'schemaCreated', state };
          case 'loadSampleMemory':
            state = loadSampleGraphKnowledge(request.now);
            return { type: 'sampleMemoryLoaded', state };
          case 'ingestText':
            state = ingestGraphKnowledgeText(state, request.input);
            return { type: 'textIngested', state };
          case 'ingestSession':
            state = ingestGraphKnowledgeSession(state, request.input);
            return { type: 'sessionIngested', state };
          case 'ingestSkill':
            state = ingestGraphKnowledgeSkill(state, request.input);
            return { type: 'skillIngested', state };
          case 'ingestTaskTrace':
            state = ingestGraphKnowledgeTaskTrace(state, request.input);
            return { type: 'taskTraceIngested', state };
          case 'runQuery':
            return { type: 'queryRan', rows: runLocalQuery(state, request.query) };
          case 'searchMemory':
            return { type: 'memorySearched', result: searchGraphKnowledge(state, request.query) };
          case 'retrieveHotMemory':
            return { type: 'hotMemoryRetrieved', result: searchGraphKnowledge(state, request.query).hotMemoryBlocks };
          case 'retrieveLexical':
            return { type: 'lexicalRetrieved', result: searchGraphKnowledge(state, request.query).evidence };
          case 'retrieveEntities':
            return { type: 'entitiesRetrieved', result: searchGraphKnowledge(state, request.query).entities };
          case 'retrievePaths':
            return { type: 'pathsRetrieved', result: searchGraphKnowledge(state, request.query).paths };
          case 'retrieveByActivation':
            return { type: 'activationRetrieved', result: searchGraphKnowledge(state, request.query).activation };
          case 'retrieveCommunities':
            return { type: 'communitiesRetrieved', result: searchGraphKnowledge(state, request.query).communities };
          case 'retrieveTemporal':
            return { type: 'temporalRetrieved', result: searchGraphKnowledge(state, request.query).temporalCaveats };
          case 'retrieveProcedural':
            return { type: 'proceduralRetrieved', result: searchGraphKnowledge(state, request.query).skills };
          case 'buildContextPack':
            return { type: 'contextPackBuilt', contextPack: buildGraphKnowledgeContextPack(state, request.query) };
          case 'consolidateMemory':
            state = consolidateGraphKnowledge(state);
            return { type: 'memoryConsolidated', state };
          case 'promoteToHotMemory':
            state = promoteGraphKnowledgeToHotMemory(state, request.query);
            return { type: 'hotMemoryPromoted', state };
          case 'evolveMemoryLinks':
            state = evolveLinks(state);
            return { type: 'memoryLinksEvolved', state };
          case 'detectContradictions': {
            state = consolidateGraphKnowledge(state);
            const contradictions = searchGraphKnowledge(state, '').contradictions;
            return { type: 'contradictionsDetected', contradictions, state };
          }
          case 'getSchema':
            return { type: 'schemaLoaded', schema: state.schema };
          case 'getMemoryStats':
            return { type: 'memoryStatsLoaded', stats: getGraphKnowledgeStats(state) };
          case 'importMemory':
            state = importGraphKnowledge(request.serialized);
            return { type: 'memoryImported', state };
          case 'exportMemory':
            return { type: 'memoryExported', serialized: exportGraphKnowledge(state) };
          case 'resetDatabase':
            state = createEmptyGraphKnowledgeState(request.now);
            return { type: 'databaseReset', state };
        }
      } catch (error) {
        return { type: 'workerError', message: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}

function runLocalQuery(state: GraphKnowledgeState, query: string): Array<Record<string, string | number>> {
  const normalized = query.toLowerCase();
  if (normalized.includes('hotmemoryblock')) {
    return state.hotMemoryBlocks.map((block) => ({
      name: block.name,
      content: block.content,
      currentCharCount: block.currentCharCount,
      charBudget: block.charBudget,
    }));
  }
  if (normalized.includes('document') && normalized.includes('chunk')) {
    return state.chunks.map((chunk) => ({
      document: state.documents.find((document) => document.id === chunk.documentId)?.title ?? chunk.documentId,
      chunk: chunk.id,
      text: chunk.text,
    }));
  }
  if (normalized.includes('claim')) {
    return state.claims.map((claim) => ({
      id: claim.id,
      text: claim.text,
      confidence: claim.confidence,
      status: claim.status,
    }));
  }
  return [
    { label: 'nodes', value: getGraphKnowledgeStats(state).graphNodes },
    { label: 'edges', value: getGraphKnowledgeStats(state).graphEdges },
  ];
}

function evolveLinks(state: GraphKnowledgeState): GraphKnowledgeState {
  const relatedMemories = state.atomicMemories.filter((memory) => memory.content.toLowerCase().includes('graph'));
  const relations = relatedMemories.slice(1).map((memory, index) => ({
    id: `rel:SIMILAR_TO:${relatedMemories[index].id}:${memory.id}`,
    type: 'SIMILAR_TO' as const,
    fromId: relatedMemories[index].id,
    toId: memory.id,
    confidence: 0.7,
    weight: 0.7,
    createdAt: state.updatedAt,
  }));
  return {
    ...state,
    relations: [...state.relations, ...relations.filter((relation) => !state.relations.some((existing) => existing.id === relation.id))],
  };
}
