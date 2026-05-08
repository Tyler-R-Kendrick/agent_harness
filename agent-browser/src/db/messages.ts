import type {
  GraphKnowledgeContextPack,
  GraphKnowledgeSearchResult,
  GraphKnowledgeSessionInput,
  GraphKnowledgeSkillInput,
  GraphKnowledgeState,
  GraphKnowledgeStats,
  GraphKnowledgeTaskTraceInput,
  GraphKnowledgeTextInput,
} from '../services/graphKnowledge';

export type GraphKnowledgeWorkerRequest =
  | { type: 'init'; now?: string }
  | { type: 'createSchema' }
  | { type: 'loadSampleMemory'; now?: string }
  | { type: 'ingestText'; input: GraphKnowledgeTextInput }
  | { type: 'ingestSession'; input: GraphKnowledgeSessionInput }
  | { type: 'ingestSkill'; input: GraphKnowledgeSkillInput }
  | { type: 'ingestTaskTrace'; input: GraphKnowledgeTaskTraceInput }
  | { type: 'runQuery'; query: string }
  | { type: 'searchMemory'; query: string }
  | { type: 'retrieveHotMemory'; query: string }
  | { type: 'retrieveLexical'; query: string }
  | { type: 'retrieveEntities'; query: string }
  | { type: 'retrievePaths'; query: string }
  | { type: 'retrieveByActivation'; query: string }
  | { type: 'retrieveCommunities'; query: string }
  | { type: 'retrieveTemporal'; query: string }
  | { type: 'retrieveProcedural'; query: string }
  | { type: 'buildContextPack'; query: string }
  | { type: 'consolidateMemory' }
  | { type: 'promoteToHotMemory'; query: string }
  | { type: 'evolveMemoryLinks' }
  | { type: 'detectContradictions' }
  | { type: 'getSchema' }
  | { type: 'getMemoryStats' }
  | { type: 'importMemory'; serialized: string }
  | { type: 'exportMemory' }
  | { type: 'resetDatabase'; now?: string };

export type GraphKnowledgeWorkerResponse =
  | { type: 'initialized'; status: 'ready'; state: GraphKnowledgeState }
  | { type: 'schemaCreated'; state: GraphKnowledgeState }
  | { type: 'sampleMemoryLoaded'; state: GraphKnowledgeState }
  | { type: 'textIngested'; state: GraphKnowledgeState }
  | { type: 'sessionIngested'; state: GraphKnowledgeState }
  | { type: 'skillIngested'; state: GraphKnowledgeState }
  | { type: 'taskTraceIngested'; state: GraphKnowledgeState }
  | { type: 'queryRan'; rows: Array<Record<string, string | number>> }
  | { type: 'memorySearched'; result: GraphKnowledgeSearchResult }
  | { type: 'hotMemoryRetrieved'; result: GraphKnowledgeSearchResult['hotMemoryBlocks'] }
  | { type: 'lexicalRetrieved'; result: GraphKnowledgeSearchResult['evidence'] }
  | { type: 'entitiesRetrieved'; result: GraphKnowledgeSearchResult['entities'] }
  | { type: 'pathsRetrieved'; result: GraphKnowledgeSearchResult['paths'] }
  | { type: 'activationRetrieved'; result: GraphKnowledgeSearchResult['activation'] }
  | { type: 'communitiesRetrieved'; result: GraphKnowledgeSearchResult['communities'] }
  | { type: 'temporalRetrieved'; result: GraphKnowledgeSearchResult['temporalCaveats'] }
  | { type: 'proceduralRetrieved'; result: GraphKnowledgeSearchResult['skills'] }
  | { type: 'contextPackBuilt'; contextPack: GraphKnowledgeContextPack }
  | { type: 'memoryConsolidated'; state: GraphKnowledgeState }
  | { type: 'hotMemoryPromoted'; state: GraphKnowledgeState }
  | { type: 'memoryLinksEvolved'; state: GraphKnowledgeState }
  | { type: 'contradictionsDetected'; contradictions: GraphKnowledgeSearchResult['contradictions']; state: GraphKnowledgeState }
  | { type: 'schemaLoaded'; schema: GraphKnowledgeState['schema'] }
  | { type: 'memoryStatsLoaded'; stats: GraphKnowledgeStats }
  | { type: 'memoryImported'; state: GraphKnowledgeState }
  | { type: 'memoryExported'; serialized: string }
  | { type: 'databaseReset'; state: GraphKnowledgeState }
  | { type: 'workerError'; message: string };
