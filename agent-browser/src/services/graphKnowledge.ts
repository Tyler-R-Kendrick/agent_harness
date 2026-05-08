export type GraphKnowledgeStatus = 'initializing' | 'ready' | 'error' | 'offline-ready';
export type GraphNodeKind =
  | 'Document'
  | 'Chunk'
  | 'Session'
  | 'Turn'
  | 'Evidence'
  | 'Entity'
  | 'Alias'
  | 'Topic'
  | 'Claim'
  | 'Fact'
  | 'Event'
  | 'Observation'
  | 'AtomicMemory'
  | 'HotMemoryBlock'
  | 'Skill'
  | 'TaskTrace'
  | 'ContextPack'
  | 'Community'
  | 'PathRecord'
  | 'RetrievalTrace';

export type GraphRelationshipType =
  | 'HAS_CHUNK'
  | 'HAS_TURN'
  | 'DERIVED_FROM'
  | 'NEXT_CHUNK'
  | 'CITES'
  | 'MENTIONS'
  | 'HAS_ALIAS'
  | 'ABOUT'
  | 'RELATED_TO'
  | 'INSTANCE_OF'
  | 'PART_OF'
  | 'SUPPORTS'
  | 'REFUTES'
  | 'CONTRADICTS'
  | 'ENTAILS'
  | 'EXPRESSES'
  | 'ABOUT_ENTITY'
  | 'ABOUT_TOPIC'
  | 'OBSERVED_IN'
  | 'CAUSED_BY'
  | 'BEFORE'
  | 'AFTER'
  | 'UPDATES'
  | 'SUPERSEDES'
  | 'LINKS_TO'
  | 'SIMILAR_TO'
  | 'EVOLVED_FROM'
  | 'PROMOTED_TO'
  | 'ARCHIVED_AS'
  | 'SUMMARIZES'
  | 'CONNECTS'
  | 'PRODUCED_SKILL'
  | 'USES_SKILL'
  | 'REFINES_SKILL'
  | 'DEPENDS_ON'
  | 'MEMBER_OF'
  | 'COMMUNITY_PARENT'
  | 'PATH_INCLUDES'
  | 'RETRIEVED_BY';

export interface HotMemoryBlock {
  id: string;
  name: string;
  content: string;
  charBudget: number;
  currentCharCount: number;
  sourceMemoryIds: string[];
  confidence: number;
  version: number;
  lastUpdatedAt: string;
}

export interface SourceDocument {
  id: string;
  title: string;
  source: string;
  sourceType: string;
  createdAt: string;
  updatedAt: string;
  importedAt: string;
  hash: string;
  trustLevel: 'low' | 'medium' | 'high';
}

export interface SourceChunk {
  id: string;
  documentId: string;
  text: string;
  tokenEstimate: number;
  order: number;
  createdAt: string;
  hash: string;
}

export interface SessionRecord {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  summary: string;
  source: string;
}

export interface TurnRecord {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  order: number;
}

export interface EvidenceRecord {
  id: string;
  kind: 'chunk' | 'turn' | 'note' | 'skill' | 'task-trace';
  text: string;
  sourceRef: string;
  confidence: number;
  createdAt: string;
}

export interface EntityNode {
  id: string;
  canonicalName: string;
  type: string;
  description: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface AliasNode {
  id: string;
  entityId: string;
  value: string;
  normalizedValue: string;
}

export interface TopicNode {
  id: string;
  name: string;
  description: string;
  weight: number;
}

export interface ClaimNode {
  id: string;
  text: string;
  normalizedText: string;
  confidence: number;
  polarity: 'positive' | 'negative' | 'neutral';
  status: 'active' | 'superseded' | 'contradicted';
  createdAt: string;
  updatedAt: string;
  subject: string;
  predicate: string;
}

export interface FactNode {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  validFrom: string | null;
  validTo: string | null;
  observedAt: string;
  status: 'active' | 'superseded' | 'contradicted';
}

export interface EventNode {
  id: string;
  name: string;
  description: string;
  eventTime: string;
  observedAt: string;
  confidence: number;
}

export interface ObservationNode {
  id: string;
  text: string;
  observedAt: string;
  source: string;
  confidence: number;
}

export interface AtomicMemoryNode {
  id: string;
  title: string;
  content: string;
  kind: 'semantic' | 'episodic' | 'procedural' | 'summary';
  importance: number;
  confidence: number;
  novelty: number;
  recencyScore: number;
  accessCount: number;
  lastAccessedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillNode {
  id: string;
  name: string;
  description: string;
  triggerConditions: string[];
  steps: string[];
  tools: string[];
  successCriteria: string[];
  failureModes: string[];
  examples: string[];
  confidence: number;
  useCount: number;
  lastUsedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskTraceNode {
  id: string;
  task: string;
  outcome: string;
  stepsJson: string;
  lessons: string;
  createdAt: string;
}

export interface CommunityNode {
  id: string;
  name: string;
  level: number;
  summary: string;
  importance: number;
  createdAt: string;
  updatedAt: string;
}

export interface PathRecordNode {
  id: string;
  question: string;
  pathJson: string;
  score: number;
  explanation: string;
  createdAt: string;
}

export interface RetrievalTraceNode {
  id: string;
  query: string;
  strategy: string;
  seedsJson: string;
  resultsJson: string;
  createdAt: string;
  feedbackScore: number | null;
}

export interface GraphRelation {
  id: string;
  type: GraphRelationshipType;
  fromId: string;
  toId: string;
  confidence: number;
  weight: number;
  createdAt: string;
}

export interface GraphKnowledgeSchema {
  version: 'graph-knowledge/v1';
  nodeCategories: GraphNodeKind[];
  relationshipTypes: GraphRelationshipType[];
}

export interface GraphKnowledgeState {
  schema: GraphKnowledgeSchema;
  status: GraphKnowledgeStatus;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  hotMemoryBlocks: HotMemoryBlock[];
  documents: SourceDocument[];
  chunks: SourceChunk[];
  sessions: SessionRecord[];
  turns: TurnRecord[];
  evidence: EvidenceRecord[];
  entities: EntityNode[];
  aliases: AliasNode[];
  topics: TopicNode[];
  claims: ClaimNode[];
  facts: FactNode[];
  events: EventNode[];
  observations: ObservationNode[];
  atomicMemories: AtomicMemoryNode[];
  skills: SkillNode[];
  taskTraces: TaskTraceNode[];
  communities: CommunityNode[];
  paths: PathRecordNode[];
  retrievalTraces: RetrievalTraceNode[];
  contextPacks: GraphKnowledgeContextPack[];
  relations: GraphRelation[];
}

export interface GraphKnowledgeStats {
  status: GraphKnowledgeStatus;
  hotMemoryBlocks: number;
  hotMemoryChars: number;
  graphNodes: number;
  graphEdges: number;
  archiveRecords: number;
  documentCount: number;
  sessionCount: number;
  skillCount: number;
  contextPackCount: number;
}

export interface GraphKnowledgeScoreBreakdown {
  id: string;
  label: string;
  lexicalScore: number;
  entityScore: number;
  topicScore: number;
  pathScore: number;
  activationScore: number;
  temporalScore: number;
  importanceScore: number;
  confidenceScore: number;
  recencyScore: number;
  proceduralScore: number;
  contradictionPenalty: number;
  pathLengthPenalty: number;
  totalScore: number;
}

export interface GraphActivationResult {
  id: string;
  label: string;
  kind: GraphNodeKind;
  score: number;
  scoreBreakdown: GraphKnowledgeScoreBreakdown;
}

export interface GraphKnowledgeSearchResult {
  query: string;
  hotMemoryBlocks: HotMemoryBlock[];
  evidence: EvidenceRecord[];
  entities: EntityNode[];
  topics: TopicNode[];
  claims: ClaimNode[];
  facts: FactNode[];
  paths: PathRecordNode[];
  communities: CommunityNode[];
  skills: SkillNode[];
  activation: GraphActivationResult[];
  temporalCaveats: string[];
  contradictions: ClaimNode[];
  scoreBreakdowns: GraphKnowledgeScoreBreakdown[];
  retrievalTrace: RetrievalTraceNode;
}

export interface GraphKnowledgeContextPack {
  id: string;
  question: string;
  generatedContext: string;
  text: string;
  createdAt: string;
  retrievalConfigJson: string;
  feedbackScore: number | null;
  localCitationIds: string[];
  tokenEstimate: number;
}

export interface GraphKnowledgeTextInput {
  title: string;
  text: string;
  source: string;
  now?: string;
}

export interface GraphKnowledgeSessionInput {
  title: string;
  turns: Array<{ role: TurnRecord['role']; text: string }>;
  source?: string;
  now?: string;
}

export interface GraphKnowledgeSkillInput {
  name: string;
  description: string;
  steps: string[];
  tools: string[];
  now?: string;
}

export interface GraphKnowledgeTaskTraceInput {
  task: string;
  outcome: string;
  steps: string[];
  lessons: string;
  now?: string;
}

export interface GraphKnowledgeSearchConfig {
  maxDepth?: number;
  limit?: number;
  contextBudget?: number;
}

const NODE_CATEGORIES: GraphNodeKind[] = [
  'Document',
  'Chunk',
  'Session',
  'Turn',
  'Evidence',
  'Entity',
  'Alias',
  'Topic',
  'Claim',
  'Fact',
  'Event',
  'Observation',
  'AtomicMemory',
  'HotMemoryBlock',
  'Skill',
  'TaskTrace',
  'ContextPack',
  'Community',
  'PathRecord',
  'RetrievalTrace',
];

const RELATIONSHIP_TYPES: GraphRelationshipType[] = [
  'HAS_CHUNK',
  'HAS_TURN',
  'DERIVED_FROM',
  'NEXT_CHUNK',
  'CITES',
  'MENTIONS',
  'HAS_ALIAS',
  'ABOUT',
  'RELATED_TO',
  'INSTANCE_OF',
  'PART_OF',
  'SUPPORTS',
  'REFUTES',
  'CONTRADICTS',
  'ENTAILS',
  'EXPRESSES',
  'ABOUT_ENTITY',
  'ABOUT_TOPIC',
  'OBSERVED_IN',
  'CAUSED_BY',
  'BEFORE',
  'AFTER',
  'UPDATES',
  'SUPERSEDES',
  'LINKS_TO',
  'SIMILAR_TO',
  'EVOLVED_FROM',
  'PROMOTED_TO',
  'ARCHIVED_AS',
  'SUMMARIZES',
  'CONNECTS',
  'PRODUCED_SKILL',
  'USES_SKILL',
  'REFINES_SKILL',
  'DEPENDS_ON',
  'MEMBER_OF',
  'COMMUNITY_PARENT',
  'PATH_INCLUDES',
  'RETRIEVED_BY',
];

const DOMAIN_TERMS = [
  'Agent Browser',
  'Azure AI Search',
  'GraphRAG',
  'PathRAG',
  'HippoRAG',
  'Kuzu-WASM',
  'IndexedDB',
  'Web Worker',
  'Static Web App',
  'Hot Memory',
  'Session Archive',
  'Procedural Skill',
  'WASM',
  'Graph Knowledge',
];

function nowIso(value?: string): string {
  return value ?? new Date().toISOString();
}

function hashText(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokenize(value: string): string[] {
  return normalize(value).split(/\s+/).filter(Boolean);
}

function estimateTokens(text: string): number {
  return Math.ceil(tokenize(text).length * 1.35);
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const next: T[] = [];
  for (const item of items) {
    const itemKey = key(item);
    if (seen.has(itemKey)) continue;
    seen.add(itemKey);
    next.push(item);
  }
  return next;
}

function scoreText(text: string, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  const tokens = tokenize(text);
  const tokenSet = new Set(tokens);
  const overlap = queryTokens.filter((token) => tokenSet.has(token)).length;
  const phraseBoost = normalize(text).includes(queryTokens.join(' ')) ? 2 : 0;
  return overlap + phraseBoost;
}

function scoreBreakdown(
  id: string,
  label: string,
  partial: Partial<Omit<GraphKnowledgeScoreBreakdown, 'id' | 'label' | 'totalScore'>>,
): GraphKnowledgeScoreBreakdown {
  const base = {
    lexicalScore: 0,
    entityScore: 0,
    topicScore: 0,
    pathScore: 0,
    activationScore: 0,
    temporalScore: 0,
    importanceScore: 0,
    confidenceScore: 0,
    recencyScore: 0,
    proceduralScore: 0,
    contradictionPenalty: 0,
    pathLengthPenalty: 0,
    ...partial,
  };
  const totalScore = Math.max(
    0,
    base.lexicalScore
      + base.entityScore
      + base.topicScore
      + base.pathScore
      + base.activationScore
      + base.temporalScore
      + base.importanceScore
      + base.confidenceScore
      + base.recencyScore
      + base.proceduralScore
      - base.contradictionPenalty
      - base.pathLengthPenalty,
  );
  return { id, label, ...base, totalScore };
}

function relation(
  type: GraphRelationshipType,
  fromId: string,
  toId: string,
  createdAt: string,
  weight = 1,
  confidence = 0.8,
): GraphRelation {
  return {
    id: `rel:${type}:${fromId}:${toId}`,
    type,
    fromId,
    toId,
    confidence,
    weight,
    createdAt,
  };
}

export function createEmptyGraphKnowledgeState(now = nowIso()): GraphKnowledgeState {
  return {
    schema: {
      version: 'graph-knowledge/v1',
      nodeCategories: NODE_CATEGORIES,
      relationshipTypes: RELATIONSHIP_TYPES,
    },
    status: 'ready',
    error: null,
    createdAt: now,
    updatedAt: now,
    hotMemoryBlocks: [],
    documents: [],
    chunks: [],
    sessions: [],
    turns: [],
    evidence: [],
    entities: [],
    aliases: [],
    topics: [],
    claims: [],
    facts: [],
    events: [],
    observations: [],
    atomicMemories: [],
    skills: [],
    taskTraces: [],
    communities: [],
    paths: [],
    retrievalTraces: [],
    contextPacks: [],
    relations: [],
  };
}

function sampleEntities(now: string): EntityNode[] {
  return [
    ['entity:kuzu-wasm', 'Kuzu-WASM', 'technology', 'Browser-local WASM graph database candidate for persistent memory.'],
    ['entity:graphrag', 'GraphRAG', 'retrieval-pattern', 'Entity graph and community-summary retrieval pattern.'],
    ['entity:pathrag', 'PathRAG', 'retrieval-pattern', 'Path-based retrieval pattern for explainable graph reasoning.'],
    ['entity:hipporag', 'HippoRAG', 'retrieval-pattern', 'Activation-based graph retrieval inspired by human memory.'],
    ['entity:indexeddb', 'IndexedDB', 'storage', 'Browser storage used for durable offline graph state.'],
    ['entity:web-worker', 'Web Worker', 'runtime', 'Off-main-thread execution boundary for graph operations.'],
    ['entity:hot-memory', 'Hot Memory', 'memory-tier', 'Bounded prompt-ready memory tier.'],
    ['entity:session-archive', 'Session Archive', 'memory-tier', 'Cold episodic archive tier.'],
    ['entity:procedural-skill', 'Procedural Skill', 'memory-tier', 'Reusable task procedure memory.'],
    ['entity:azure-ai-search', 'Azure AI Search', 'technology', 'Enterprise retrieval service used as comparison data.'],
  ].map(([id, canonicalName, type, description]) => ({
    id,
    canonicalName,
    type,
    description,
    confidence: 0.86,
    createdAt: now,
    updatedAt: now,
  }));
}

function aliasFor(entity: EntityNode): AliasNode[] {
  const normalized = normalize(entity.canonicalName);
  const aliases = [entity.canonicalName, normalized];
  if (entity.canonicalName === 'Kuzu-WASM') aliases.push('kuzu wasm', 'kuzu');
  if (entity.canonicalName === 'PathRAG') aliases.push('path rag');
  if (entity.canonicalName === 'GraphRAG') aliases.push('graph rag');
  return uniqueBy(aliases, (value) => value).map((value, index) => ({
    id: `alias:${entity.id}:${index}`,
    entityId: entity.id,
    value,
    normalizedValue: normalize(value),
  }));
}

export function loadSampleGraphKnowledge(now = nowIso()): GraphKnowledgeState {
  let state = createEmptyGraphKnowledgeState(now);
  const entities = sampleEntities(now);
  const topics: TopicNode[] = [
    { id: 'topic:retrieval', name: 'retrieval', description: 'Finding relevant graph memory for a question.', weight: 0.9 },
    { id: 'topic:persistence', name: 'persistence', description: 'Keeping memory durable offline.', weight: 0.85 },
    { id: 'topic:offline-mode', name: 'offline mode', description: 'No backend or network dependency after load.', weight: 0.9 },
    { id: 'topic:graph-traversal', name: 'graph traversal', description: 'Walking memory paths between entities and claims.', weight: 0.88 },
    { id: 'topic:temporal-recall', name: 'temporal recall', description: 'Observation and valid-time aware memory.', weight: 0.72 },
    { id: 'topic:procedures', name: 'procedures', description: 'Reusable task traces and skills.', weight: 0.78 },
  ];
  const communities: CommunityNode[] = [
    {
      id: 'community:offline-graph-memory',
      name: 'Offline graph memory',
      level: 0,
      summary: 'Browser-local graph memory combines Kuzu-WASM, IndexedDB, a worker boundary, and tiered retrieval.',
      importance: 0.93,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'community:retrieval-patterns',
      name: 'Retrieval patterns',
      level: 1,
      summary: 'GraphRAG, PathRAG, and HippoRAG-style activation complement lexical search for explainable recall.',
      importance: 0.9,
      createdAt: now,
      updatedAt: now,
    },
  ];

  state = {
    ...state,
    status: 'offline-ready',
    hotMemoryBlocks: [
      hotBlock('hot:identity', 'identity_profile', 'The user is building local-first browser agent memory systems.', 240, ['memory:goal'], 0.9, now),
      hotBlock('hot:projects', 'active_projects', 'Current project: WASM graph memory for GraphRAG, PathRAG, activation retrieval, and persistent context packs.', 320, ['memory:retrieval'], 0.86, now),
      hotBlock('hot:principles', 'operating_principles', 'Prefer deterministic offline extraction first; keep future LLM, embedding, and Kuzu adapters behind typed interfaces.', 320, ['memory:worker'], 0.84, now),
    ],
    entities,
    aliases: entities.flatMap(aliasFor),
    topics,
    communities,
    skills: [
      skillNode('skill:offline-wasm-graph-app', 'Build offline WASM graph app', 'Create a static app with a worker-owned graph engine and durable IndexedDB state.', ['offline graph app', 'WASM persistence'], ['Create schema', 'Load sample memory', 'Ingest text', 'Generate context pack'], ['TypeScript', 'Vite', 'IndexedDB'], now),
      skillNode('skill:debug-worker-persistence', 'Debug worker persistence', 'Recover from local worker persistence failures without data loss.', ['worker persistence error', 'import export'], ['Export memory', 'Validate payload', 'Reset database', 'Import backup'], ['browser devtools', 'Vitest'], now),
    ],
    taskTraces: [
      {
        id: 'trace:offline-graph-implementation',
        task: 'Implement offline graph memory worker',
        outcome: 'success',
        stepsJson: JSON.stringify(['define schema', 'ingest sample data', 'search memory', 'verify context pack']),
        lessons: 'Keep graph operations behind one message boundary and expose score breakdowns.',
        createdAt: now,
      },
    ],
  };

  state = ingestGraphKnowledgeText(state, {
    title: 'Enterprise retrieval pipeline',
    source: 'sample document',
    now,
    text: 'Kuzu-WASM enables a local graph database in the browser. GraphRAG uses entity graphs and community summaries for local and global retrieval. PathRAG improves explainability for relational questions by returning short paths with evidence. HippoRAG-style activation spreads from query entities through related claims and memories. IndexedDB keeps graph state persistent after refresh.',
  });
  state = ingestGraphKnowledgeSession(state, {
    title: 'Agent memory design session',
    source: 'sample session',
    now,
    turns: [
      { role: 'user', text: 'We need hot prompt memory plus durable graph recall for offline agent workflows.' },
      { role: 'assistant', text: 'Use Hot Memory for bounded prompt blocks, Tier 2 graph memory for retrieval, and Session Archive plus Procedural Skill records for cold memory.' },
      { role: 'user', text: 'Path retrieval should show why Kuzu-WASM and PathRAG are connected.' },
    ],
  });
  state = ingestGraphKnowledgeText(state, {
    title: 'Retrieval trade-offs',
    source: 'sample contradiction document',
    now,
    text: 'Path-based retrieval improves explainability for relational questions. Path-based retrieval reduces explainability when paths are too long or low confidence.',
  });

  const relationSeeds: GraphRelation[] = [
    relation('RELATED_TO', 'entity:kuzu-wasm', 'entity:indexeddb', now, 0.9),
    relation('RELATED_TO', 'entity:kuzu-wasm', 'entity:web-worker', now, 0.9),
    relation('RELATED_TO', 'entity:graphrag', 'entity:pathrag', now, 0.8),
    relation('RELATED_TO', 'entity:pathrag', 'entity:hipporag', now, 0.7),
    relation('MEMBER_OF', 'entity:kuzu-wasm', 'community:offline-graph-memory', now, 0.9),
    relation('MEMBER_OF', 'entity:indexeddb', 'community:offline-graph-memory', now, 0.8),
    relation('MEMBER_OF', 'entity:web-worker', 'community:offline-graph-memory', now, 0.8),
    relation('MEMBER_OF', 'entity:graphrag', 'community:retrieval-patterns', now, 0.9),
    relation('MEMBER_OF', 'entity:pathrag', 'community:retrieval-patterns', now, 0.9),
    relation('MEMBER_OF', 'entity:hipporag', 'community:retrieval-patterns', now, 0.8),
    relation('COMMUNITY_PARENT', 'community:retrieval-patterns', 'community:offline-graph-memory', now, 0.7),
    relation('PRODUCED_SKILL', 'trace:offline-graph-implementation', 'skill:offline-wasm-graph-app', now, 0.8),
  ];

  return consolidateGraphKnowledge({
    ...state,
    relations: uniqueBy([...state.relations, ...relationSeeds], (entry) => entry.id),
    updatedAt: now,
  });
}

function hotBlock(id: string, name: string, content: string, charBudget: number, sourceMemoryIds: string[], confidence: number, now: string): HotMemoryBlock {
  return {
    id,
    name,
    content,
    charBudget,
    currentCharCount: content.length,
    sourceMemoryIds,
    confidence,
    version: 1,
    lastUpdatedAt: now,
  };
}

function skillNode(id: string, name: string, description: string, triggerConditions: string[], steps: string[], tools: string[], now: string): SkillNode {
  return {
    id,
    name,
    description,
    triggerConditions,
    steps,
    tools,
    successCriteria: ['Context pack includes procedural steps', 'No network dependency is required'],
    failureModes: ['Storage quota exhausted', 'Worker initialization fails'],
    examples: [`Use ${name} when a user asks about ${triggerConditions[0]}.`],
    confidence: 0.84,
    useCount: 1,
    lastUsedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function extractEntityNames(text: string): string[] {
  const domainMatches = DOMAIN_TERMS.filter((term) => normalize(text).includes(normalize(term)));
  const capitalizedMatches = Array.from(text.matchAll(/\b[A-Z][A-Za-z0-9-]+(?:\s+[A-Z][A-Za-z0-9-]+){0,3}\b/g))
    .map((match) => match[0])
    .filter((value) => value.length > 2);
  const acronymMatches = Array.from(text.matchAll(/\b[A-Z][A-Z0-9-]{2,}\b/g)).map((match) => match[0]);
  return uniqueBy([...domainMatches, ...capitalizedMatches, ...acronymMatches], normalize);
}

function upsertEntity(state: GraphKnowledgeState, name: string, now: string): [GraphKnowledgeState, EntityNode] {
  const normalized = normalize(name);
  const existing = state.entities.find((entity) => normalize(entity.canonicalName) === normalized)
    ?? state.aliases
      .map((alias) => state.entities.find((entity) => entity.id === alias.entityId && alias.normalizedValue === normalized))
      .find((entity): entity is EntityNode => Boolean(entity));
  if (existing) return [state, existing];

  const entity: EntityNode = {
    id: `entity:${hashText(normalized)}`,
    canonicalName: name,
    type: name.includes('RAG') ? 'retrieval-pattern' : 'concept',
    description: `Extracted local graph entity for ${name}.`,
    confidence: 0.72,
    createdAt: now,
    updatedAt: now,
  };
  const aliases = aliasFor(entity);
  return [{ ...state, entities: [...state.entities, entity], aliases: [...state.aliases, ...aliases] }, entity];
}

function claimFromSentence(sentence: string, now: string, index: number): ClaimNode | null {
  const match = sentence.match(/\b(is|are|enables|requires|improves|causes|supports|reduces|increases|depends on|contradicts|keeps|uses)\b/i);
  if (!match) return null;
  const subject = sentence.slice(0, match.index).trim().replace(/[.?!]$/, '') || 'memory';
  const polarity = /\b(reduces|contradicts|fails|not)\b/i.test(sentence) ? 'negative' : 'positive';
  return {
    id: `claim:${hashText(`${sentence}:${index}`)}`,
    text: sentence.replace(/[.?!]$/, ''),
    normalizedText: normalize(sentence),
    confidence: 0.76,
    polarity,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    subject: normalize(subject).split(' ').slice(0, 4).join(' '),
    predicate: normalize(match[0]),
  };
}

function factFromClaim(claim: ClaimNode, now: string): FactNode {
  return {
    id: `fact:${claim.id}`,
    subject: claim.subject,
    predicate: claim.predicate,
    object: claim.text,
    confidence: claim.confidence,
    validFrom: null,
    validTo: null,
    observedAt: now,
    status: claim.status === 'superseded' ? 'superseded' : 'active',
  };
}

function topicFromTokens(tokens: string[], nowState: GraphKnowledgeState): TopicNode[] {
  const counts = new Map<string, number>();
  tokens
    .filter((token) => token.length > 5)
    .forEach((token) => counts.set(token, (counts.get(token) ?? 0) + 1));
  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .map(([name, count]) => ({
      id: `topic:${hashText(name)}`,
      name,
      description: `Repeated local extraction topic: ${name}.`,
      weight: Math.min(1, 0.45 + count * 0.12),
    }))
    .filter((topic) => !nowState.topics.some((existing) => existing.id === topic.id));
}

export function ingestGraphKnowledgeText(state: GraphKnowledgeState, input: GraphKnowledgeTextInput): GraphKnowledgeState {
  const timestamp = nowIso(input.now);
  const documentId = `doc:${hashText(`${input.title}:${input.source}`)}`;
  const document: SourceDocument = {
    id: documentId,
    title: input.title,
    source: input.source,
    sourceType: 'text',
    createdAt: timestamp,
    updatedAt: timestamp,
    importedAt: timestamp,
    hash: hashText(input.text),
    trustLevel: 'medium',
  };
  const sentences = splitSentences(input.text);
  const chunks = sentences.map((sentence, index) => ({
    id: `chunk:${documentId}:${index}`,
    documentId,
    text: sentence,
    tokenEstimate: estimateTokens(sentence),
    order: index,
    createdAt: timestamp,
    hash: hashText(sentence),
  }));
  const evidence = chunks.map((chunk) => ({
    id: `evidence:${chunk.id}`,
    kind: 'chunk' as const,
    text: chunk.text,
    sourceRef: `${input.source}:${chunk.id}`,
    confidence: 0.78,
    createdAt: timestamp,
  }));
  const claims = sentences
    .map((sentence, index) => claimFromSentence(sentence, timestamp, index))
    .filter((claim): claim is ClaimNode => Boolean(claim));
  const facts = claims.map((claim) => factFromClaim(claim, timestamp));
  const atomicMemories = chunks.map((chunk) => ({
    id: `memory:${chunk.id}`,
    title: input.title,
    content: chunk.text,
    kind: 'semantic' as const,
    importance: scoreText(chunk.text, ['kuzu', 'graph', 'pathrag', 'memory']) > 0 ? 0.82 : 0.6,
    confidence: 0.78,
    novelty: 0.7,
    recencyScore: 0.8,
    accessCount: 0,
    lastAccessedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
  let nextState = state;
  const extractedEntities: EntityNode[] = [];
  for (const name of extractEntityNames(input.text)) {
    const [updated, entity] = upsertEntity(nextState, name, timestamp);
    nextState = updated;
    extractedEntities.push(entity);
  }
  const topics = topicFromTokens(tokenize(input.text), nextState);
  const relations = [
    relation('HAS_CHUNK', documentId, chunks[0]?.id ?? documentId, timestamp),
    ...chunks.slice(1).map((chunk, index) => relation('NEXT_CHUNK', chunks[index].id, chunk.id, timestamp, 0.65)),
    ...chunks.flatMap((chunk) => extractedEntities.map((entity) => relation('MENTIONS', chunk.id, entity.id, timestamp, 0.7))),
    ...claims.flatMap((claim) => [
      relation('DERIVED_FROM', claim.id, chunks.find((chunk) => chunk.text.includes(claim.text.slice(0, 20)))?.id ?? chunks[0]?.id ?? documentId, timestamp),
      ...extractedEntities.map((entity) => relation('ABOUT_ENTITY', claim.id, entity.id, timestamp, 0.7)),
    ]),
    ...facts.map((fact, index) => relation('EXPRESSES', fact.id, claims[index]?.id ?? fact.id, timestamp)),
    ...atomicMemories.flatMap((memory) => extractedEntities.map((entity) => relation('CONNECTS', memory.id, entity.id, timestamp, 0.75))),
  ];
  return consolidateGraphKnowledge({
    ...nextState,
    status: 'offline-ready',
    updatedAt: timestamp,
    documents: uniqueBy([...nextState.documents, document], (entry) => entry.id),
    chunks: uniqueBy([...nextState.chunks, ...chunks], (entry) => entry.id),
    evidence: uniqueBy([...nextState.evidence, ...evidence], (entry) => entry.id),
    topics: uniqueBy([...nextState.topics, ...topics], (entry) => entry.id),
    claims: uniqueBy([...nextState.claims, ...claims], (entry) => entry.id),
    facts: uniqueBy([...nextState.facts, ...facts], (entry) => entry.id),
    atomicMemories: uniqueBy([...nextState.atomicMemories, ...atomicMemories], (entry) => entry.id),
    relations: uniqueBy([...nextState.relations, ...relations], (entry) => entry.id),
  });
}

export function ingestGraphKnowledgeSession(state: GraphKnowledgeState, input: GraphKnowledgeSessionInput): GraphKnowledgeState {
  const timestamp = nowIso(input.now);
  const sessionId = `session:${hashText(`${input.title}:${timestamp}`)}`;
  const session: SessionRecord = {
    id: sessionId,
    title: input.title,
    startedAt: timestamp,
    endedAt: timestamp,
    summary: input.turns.map((turn) => turn.text).join(' ').slice(0, 220),
    source: input.source ?? 'manual session',
  };
  const turns = input.turns.map((turn, index) => ({
    id: `turn:${sessionId}:${index}`,
    sessionId,
    role: turn.role,
    text: turn.text,
    timestamp,
    order: index,
  }));
  const evidence = turns.map((turn) => ({
    id: `evidence:${turn.id}`,
    kind: 'turn' as const,
    text: turn.text,
    sourceRef: `${session.title}:${turn.id}`,
    confidence: 0.76,
    createdAt: timestamp,
  }));
  const memories = turns.map((turn) => ({
    id: `memory:${turn.id}`,
    title: `${session.title} turn ${turn.order + 1}`,
    content: turn.text,
    kind: 'episodic' as const,
    importance: turn.text.toLowerCase().includes('memory') ? 0.82 : 0.62,
    confidence: 0.75,
    novelty: 0.65,
    recencyScore: 0.88,
    accessCount: 0,
    lastAccessedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
  const relations = [
    ...turns.map((turn) => relation('HAS_TURN', sessionId, turn.id, timestamp)),
    ...memories.map((memory, index) => relation('DERIVED_FROM', memory.id, turns[index].id, timestamp)),
  ];
  return ingestExtractedSessionEntities({
    ...state,
    status: 'offline-ready',
    updatedAt: timestamp,
    sessions: uniqueBy([...state.sessions, session], (entry) => entry.id),
    turns: uniqueBy([...state.turns, ...turns], (entry) => entry.id),
    evidence: uniqueBy([...state.evidence, ...evidence], (entry) => entry.id),
    atomicMemories: uniqueBy([...state.atomicMemories, ...memories], (entry) => entry.id),
    relations: uniqueBy([...state.relations, ...relations], (entry) => entry.id),
  }, input.turns.map((turn) => turn.text).join(' '), timestamp);
}

function ingestExtractedSessionEntities(state: GraphKnowledgeState, text: string, timestamp: string): GraphKnowledgeState {
  let next = state;
  for (const name of extractEntityNames(text)) {
    [next] = upsertEntity(next, name, timestamp);
  }
  return consolidateGraphKnowledge(next);
}

export function ingestGraphKnowledgeSkill(state: GraphKnowledgeState, input: GraphKnowledgeSkillInput): GraphKnowledgeState {
  const timestamp = nowIso(input.now);
  const skill = skillNode(
    `skill:${hashText(input.name)}`,
    input.name,
    input.description,
    tokenize(`${input.name} ${input.description}`).filter((token) => token.length > 4).slice(0, 5),
    input.steps,
    input.tools,
    timestamp,
  );
  const evidence: EvidenceRecord = {
    id: `evidence:${skill.id}`,
    kind: 'skill',
    text: `${skill.name}: ${skill.description}`,
    sourceRef: `skill:${skill.name}`,
    confidence: skill.confidence,
    createdAt: timestamp,
  };
  const memory: AtomicMemoryNode = {
    id: `memory:${skill.id}`,
    title: skill.name,
    content: `${skill.description} Steps: ${skill.steps.join('; ')}`,
    kind: 'procedural',
    importance: 0.82,
    confidence: skill.confidence,
    novelty: 0.66,
    recencyScore: 0.82,
    accessCount: 0,
    lastAccessedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return {
    ...state,
    status: 'offline-ready',
    updatedAt: timestamp,
    skills: uniqueBy([...state.skills, skill], (entry) => entry.id),
    evidence: uniqueBy([...state.evidence, evidence], (entry) => entry.id),
    atomicMemories: uniqueBy([...state.atomicMemories, memory], (entry) => entry.id),
    relations: uniqueBy([...state.relations, relation('CITES', skill.id, evidence.id, timestamp), relation('CONNECTS', memory.id, skill.id, timestamp)], (entry) => entry.id),
  };
}

export function ingestGraphKnowledgeTaskTrace(state: GraphKnowledgeState, input: GraphKnowledgeTaskTraceInput): GraphKnowledgeState {
  const timestamp = nowIso(input.now);
  const trace: TaskTraceNode = {
    id: `trace:${hashText(`${input.task}:${timestamp}`)}`,
    task: input.task,
    outcome: input.outcome,
    stepsJson: JSON.stringify(input.steps),
    lessons: input.lessons,
    createdAt: timestamp,
  };
  return {
    ...state,
    status: 'offline-ready',
    updatedAt: timestamp,
    taskTraces: uniqueBy([...state.taskTraces, trace], (entry) => entry.id),
  };
}

function matchEntities(state: GraphKnowledgeState, queryTokens: string[]): EntityNode[] {
  return state.entities
    .map((entity) => {
      const aliasTokens = state.aliases
        .filter((alias) => alias.entityId === entity.id)
        .flatMap((alias) => tokenize(alias.value));
      const searchableTokens = tokenize(`${entity.canonicalName} ${entity.description}`);
      const score = queryTokens.filter((token) => searchableTokens.includes(token) || aliasTokens.includes(token)).length;
      return { entity, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || right.entity.confidence - left.entity.confidence)
    .map(({ entity }) => entity);
}

function rankItems<T extends { id: string }>(
  items: T[],
  label: (item: T) => string,
  queryTokens: string[],
  extra: (item: T) => Partial<Omit<GraphKnowledgeScoreBreakdown, 'id' | 'label' | 'totalScore'>> = () => ({}),
): Array<{ item: T; breakdown: GraphKnowledgeScoreBreakdown }> {
  return items
    .map((item) => {
      const lexicalScore = scoreText(label(item), queryTokens);
      const breakdown = scoreBreakdown(item.id, label(item), { lexicalScore, ...extra(item) });
      return { item, breakdown };
    })
    .filter(({ breakdown }) => breakdown.totalScore > 0)
    .sort((left, right) => right.breakdown.totalScore - left.breakdown.totalScore);
}

function buildPathRecords(state: GraphKnowledgeState, query: string, matchedEntities: EntityNode[], timestamp: string, limit: number): PathRecordNode[] {
  const paths: PathRecordNode[] = [];
  for (const entity of matchedEntities) {
    const firstHop = state.relations.filter((relationEntry) => relationEntry.fromId === entity.id || relationEntry.toId === entity.id);
    for (const hop of firstHop) {
      const otherId = hop.fromId === entity.id ? hop.toId : hop.fromId;
      const secondHop = state.relations.find((relationEntry) => relationEntry.fromId === otherId || relationEntry.toId === otherId);
      const path = secondHop ? [entity.id, otherId, secondHop.fromId === otherId ? secondHop.toId : secondHop.fromId] : [entity.id, otherId];
      const uniquePath = uniqueBy(path.map((id) => ({ id })), (entry) => entry.id).map((entry) => entry.id);
      paths.push({
        id: `path:${hashText(`${query}:${uniquePath.join('>')}`)}`,
        question: query,
        pathJson: JSON.stringify(uniquePath),
        score: Math.max(0.1, hop.weight + (secondHop?.weight ?? 0) - uniquePath.length * 0.08),
        explanation: `Matched query seed ${entity.canonicalName}; selected short path through ${hop.type.toLowerCase()} with local evidence.`,
        createdAt: timestamp,
      });
    }
  }
  return uniqueBy(paths, (entry) => entry.id)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function temporalCaveatsFor(facts: FactNode[], claims: ClaimNode[]): string[] {
  return [
    ...facts.slice(0, 4).map((fact) => `Fact ${fact.id} observed ${fact.observedAt}${fact.validTo ? ` and valid until ${fact.validTo}` : ''}.`),
    ...claims
      .filter((claim) => claim.status !== 'active')
      .map((claim) => `Claim ${claim.id} is ${claim.status}; include as uncertainty, not current truth.`),
  ];
}

export function searchGraphKnowledge(
  state: GraphKnowledgeState,
  query: string,
  config: GraphKnowledgeSearchConfig = {},
): GraphKnowledgeSearchResult {
  const timestamp = nowIso();
  const limit = config.limit ?? 6;
  const queryTokens = tokenize(query);
  const entities = matchEntities(state, queryTokens).slice(0, limit);
  const entityIds = new Set(entities.map((entity) => entity.id));
  const hotBlocks = rankItems(state.hotMemoryBlocks, (block) => `${block.name} ${block.content}`, queryTokens, (block) => ({
    confidenceScore: block.confidence,
    importanceScore: block.name === 'active_projects' ? 0.8 : 0.4,
  })).map(({ item }) => item).slice(0, limit);
  const rankedEvidence = rankItems(state.evidence, (entry) => `${entry.text} ${entry.sourceRef}`, queryTokens, (entry) => ({
    confidenceScore: entry.confidence,
    recencyScore: 0.4,
  })).slice(0, limit);
  const rankedClaims = rankItems(state.claims, (claim) => claim.text, queryTokens, (claim) => ({
    confidenceScore: claim.confidence,
    contradictionPenalty: claim.status === 'active' ? 0 : 0.6,
    entityScore: state.relations.some((rel) => rel.fromId === claim.id && entityIds.has(rel.toId)) ? 1 : 0,
  })).slice(0, limit);
  const rankedFacts = rankItems(state.facts, (fact) => `${fact.subject} ${fact.predicate} ${fact.object}`, queryTokens, (fact) => ({
    confidenceScore: fact.confidence,
    temporalScore: fact.validTo ? 0.3 : 0.7,
    contradictionPenalty: fact.status === 'active' ? 0 : 0.5,
  })).slice(0, limit);
  const rankedTopics = rankItems(state.topics, (topic) => `${topic.name} ${topic.description}`, queryTokens, (topic) => ({
    topicScore: topic.weight,
  })).map(({ item }) => item).slice(0, limit);
  const rankedSkills = rankItems(state.skills, (skill) => `${skill.name} ${skill.description} ${skill.steps.join(' ')}`, queryTokens, (skill) => ({
    proceduralScore: queryTokens.some((token) => ['build', 'debug', 'worker', 'skill', 'steps', 'agent'].includes(token)) ? 1 : 0.4,
    confidenceScore: skill.confidence,
  })).slice(0, limit);
  const rankedCommunities = rankItems(state.communities, (community) => `${community.name} ${community.summary}`, queryTokens, (community) => ({
    topicScore: community.importance,
  })).map(({ item }) => item).slice(0, limit);
  const paths = buildPathRecords(state, query, entities, timestamp, limit);
  const pathBreakdowns = paths.map((path) => scoreBreakdown(path.id, path.explanation, {
    pathScore: path.score,
    pathLengthPenalty: Math.max(0, JSON.parse(path.pathJson).length - (config.maxDepth ?? 3)) * 0.2,
  }));
  const activation = [
    ...rankedClaims.map(({ item, breakdown }) => ({
      id: item.id,
      label: item.text,
      kind: 'Claim' as const,
      score: breakdown.totalScore + 0.5,
      scoreBreakdown: scoreBreakdown(item.id, item.text, { ...breakdown, activationScore: 0.5 }),
    })),
    ...entities.map((entity) => ({
      id: entity.id,
      label: entity.canonicalName,
      kind: 'Entity' as const,
      score: 1.6,
      scoreBreakdown: scoreBreakdown(entity.id, entity.canonicalName, { entityScore: 1, activationScore: 0.6, confidenceScore: entity.confidence }),
    })),
  ].sort((left, right) => right.score - left.score).slice(0, limit);
  const contradictions = state.claims.filter((claim) => claim.status === 'contradicted' || claim.status === 'superseded');
  const retrievalTrace: RetrievalTraceNode = {
    id: `trace:${hashText(`${query}:${timestamp}`)}`,
    query,
    strategy: 'hybrid-local-graphrag-pathrag-activation',
    seedsJson: JSON.stringify(entities.map((entity) => entity.id)),
    resultsJson: JSON.stringify({ claims: rankedClaims.length, paths: paths.length, skills: rankedSkills.length }),
    createdAt: timestamp,
    feedbackScore: null,
  };
  return {
    query,
    hotMemoryBlocks: hotBlocks,
    evidence: rankedEvidence.map(({ item }) => item),
    entities,
    topics: rankedTopics,
    claims: rankedClaims.map(({ item }) => item),
    facts: rankedFacts.map(({ item }) => item),
    paths,
    communities: rankedCommunities,
    skills: rankedSkills.map(({ item }) => item),
    activation,
    temporalCaveats: temporalCaveatsFor(rankedFacts.map(({ item }) => item), contradictions),
    contradictions,
    scoreBreakdowns: [
      ...rankedEvidence.map(({ breakdown }) => breakdown),
      ...rankedClaims.map(({ breakdown }) => breakdown),
      ...rankedFacts.map(({ breakdown }) => breakdown),
      ...rankedSkills.map(({ breakdown }) => breakdown),
      ...pathBreakdowns,
    ].sort((left, right) => right.totalScore - left.totalScore).slice(0, limit * 2),
    retrievalTrace,
  };
}

export function buildGraphKnowledgeContextPack(
  state: GraphKnowledgeState,
  query: string,
  config: GraphKnowledgeSearchConfig = {},
): GraphKnowledgeContextPack {
  const timestamp = nowIso();
  const result = searchGraphKnowledge(state, query, config);
  const lines = [
    'HOT MEMORY',
    ...result.hotMemoryBlocks.map((block) => `- [${block.name}] ${block.content}`),
    '',
    'RELEVANT FACTS',
    ...result.facts.map((fact) => `- [Fact ${fact.id}, confidence ${fact.confidence.toFixed(2)}, observed ${fact.observedAt}] ${fact.object}`),
    '',
    'CLAIMS',
    ...result.claims.map((claim) => `- [Claim ${claim.id}, ${claim.status}, confidence ${claim.confidence.toFixed(2)}] ${claim.text}`),
    '',
    'SKILLS',
    ...result.skills.map((skill) => `- [${skill.id}] ${skill.name}: ${skill.steps.join(' -> ')}`),
    '',
    'EVIDENCE',
    ...result.evidence.map((entry) => `- [${entry.id}] ${entry.text} (${entry.sourceRef})`),
    '',
    'PATHS',
    ...result.paths.map((path, index) => `${index + 1}. ${JSON.parse(path.pathJson).join(' -> ')}. Why selected: ${path.explanation}`),
    '',
    'UNCERTAINTY',
    ...(result.temporalCaveats.length > 0 ? result.temporalCaveats.map((caveat) => `- ${caveat}`) : ['- No temporal caveats detected.']),
  ];
  const budget = config.contextBudget ?? 3600;
  const text = lines.join('\n').slice(0, budget);
  return {
    id: `context:${hashText(`${query}:${timestamp}`)}`,
    question: query,
    generatedContext: text,
    text,
    createdAt: timestamp,
    retrievalConfigJson: JSON.stringify({ strategy: result.retrievalTrace.strategy, budget }),
    feedbackScore: null,
    localCitationIds: uniqueBy([
      ...result.hotMemoryBlocks.map((block) => block.id),
      ...result.facts.map((fact) => fact.id),
      ...result.claims.map((claim) => claim.id),
      ...result.evidence.map((entry) => entry.id),
      ...result.paths.map((path) => path.id),
      ...result.skills.map((skill) => skill.id),
    ].map((id) => ({ id })), (entry) => entry.id).map((entry) => entry.id),
    tokenEstimate: estimateTokens(text),
  };
}

export function promoteGraphKnowledgeToHotMemory(state: GraphKnowledgeState, query: string): GraphKnowledgeState {
  const pack = buildGraphKnowledgeContextPack(state, query, { contextBudget: 700 });
  const content = pack.text
    .split('\n')
    .filter((line) => line.startsWith('- [Claim') || line.startsWith('- [Fact') || line.startsWith('- [Skill'))
    .slice(0, 3)
    .join(' ')
    .slice(0, 320);
  const block = hotBlock(
    'hot:recent-focus',
    'recent_focus',
    content || `Recent focus: ${query}`,
    360,
    pack.localCitationIds,
    0.8,
    pack.createdAt,
  );
  return {
    ...state,
    updatedAt: pack.createdAt,
    hotMemoryBlocks: uniqueBy([...state.hotMemoryBlocks.filter((entry) => entry.name !== 'recent_focus'), block], (entry) => entry.name),
    contextPacks: uniqueBy([...state.contextPacks, pack], (entry) => entry.id),
    relations: uniqueBy([
      ...state.relations,
      ...pack.localCitationIds.map((id) => relation('PROMOTED_TO', id, block.id, pack.createdAt, 0.65)),
    ], (entry) => entry.id),
  };
}

export function consolidateGraphKnowledge(state: GraphKnowledgeState): GraphKnowledgeState {
  const claims = state.claims.map((claim) => ({ ...claim }));
  const facts = state.facts.map((fact) => ({ ...fact }));
  const relations = [...state.relations];
  for (let leftIndex = 0; leftIndex < claims.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < claims.length; rightIndex += 1) {
      const left = claims[leftIndex];
      const right = claims[rightIndex];
      if (left.subject !== right.subject || left.polarity === right.polarity) continue;
      claims[rightIndex] = { ...right, status: 'superseded', updatedAt: state.updatedAt };
      claims[leftIndex] = { ...left, status: left.status === 'active' ? 'contradicted' : left.status, updatedAt: state.updatedAt };
      const factIndex = facts.findIndex((fact) => fact.id === `fact:${right.id}`);
      if (factIndex >= 0) facts[factIndex] = { ...facts[factIndex], status: 'superseded' };
      relations.push(relation('CONTRADICTS', left.id, right.id, state.updatedAt, 0.9));
      relations.push(relation('SUPERSEDES', right.id, left.id, state.updatedAt, 0.7));
    }
  }
  return {
    ...state,
    claims,
    facts,
    relations: uniqueBy(relations, (entry) => entry.id),
  };
}

export function getGraphKnowledgeStats(state: GraphKnowledgeState): GraphKnowledgeStats {
  const graphNodes = state.hotMemoryBlocks.length
    + state.documents.length
    + state.chunks.length
    + state.sessions.length
    + state.turns.length
    + state.evidence.length
    + state.entities.length
    + state.aliases.length
    + state.topics.length
    + state.claims.length
    + state.facts.length
    + state.events.length
    + state.observations.length
    + state.atomicMemories.length
    + state.skills.length
    + state.taskTraces.length
    + state.contextPacks.length
    + state.communities.length
    + state.paths.length
    + state.retrievalTraces.length;
  return {
    status: state.status,
    hotMemoryBlocks: state.hotMemoryBlocks.length,
    hotMemoryChars: state.hotMemoryBlocks.reduce((sum, block) => sum + block.currentCharCount, 0),
    graphNodes,
    graphEdges: state.relations.length,
    archiveRecords: state.documents.length + state.sessions.length + state.taskTraces.length,
    documentCount: state.documents.length,
    sessionCount: state.sessions.length,
    skillCount: state.skills.length,
    contextPackCount: state.contextPacks.length,
  };
}

export function exportGraphKnowledge(state: GraphKnowledgeState): string {
  return JSON.stringify(state, null, 2);
}

export function importGraphKnowledge(serialized: string): GraphKnowledgeState {
  const parsed = JSON.parse(serialized) as unknown;
  if (!isGraphKnowledgeState(parsed)) {
    throw new Error('Invalid graph knowledge export.');
  }
  return parsed;
}

function isArrayOf<T>(value: unknown, predicate: (entry: unknown) => entry is T): value is T[] {
  return Array.isArray(value) && value.every(predicate);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasString(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === 'string';
}

function hasNumber(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === 'number';
}

function isHotMemoryBlock(value: unknown): value is HotMemoryBlock {
  return isRecord(value) && hasString(value, 'id') && hasString(value, 'name') && hasString(value, 'content') && hasNumber(value, 'charBudget');
}

function isSimpleIdRecord(value: unknown): value is { id: string } {
  return isRecord(value) && hasString(value, 'id');
}

export function isGraphKnowledgeState(value: unknown): value is GraphKnowledgeState {
  if (!isRecord(value) || !isRecord(value.schema)) return false;
  return (
    value.schema.version === 'graph-knowledge/v1'
    && (value.status === 'initializing' || value.status === 'ready' || value.status === 'error' || value.status === 'offline-ready')
    && isArrayOf(value.hotMemoryBlocks, isHotMemoryBlock)
    && isArrayOf(value.documents, isSimpleIdRecord)
    && isArrayOf(value.chunks, isSimpleIdRecord)
    && isArrayOf(value.sessions, isSimpleIdRecord)
    && isArrayOf(value.turns, isSimpleIdRecord)
    && isArrayOf(value.evidence, isSimpleIdRecord)
    && isArrayOf(value.entities, isSimpleIdRecord)
    && isArrayOf(value.aliases, isSimpleIdRecord)
    && isArrayOf(value.topics, isSimpleIdRecord)
    && isArrayOf(value.claims, isSimpleIdRecord)
    && isArrayOf(value.facts, isSimpleIdRecord)
    && isArrayOf(value.atomicMemories, isSimpleIdRecord)
    && isArrayOf(value.skills, isSimpleIdRecord)
    && isArrayOf(value.taskTraces, isSimpleIdRecord)
    && isArrayOf(value.communities, isSimpleIdRecord)
    && isArrayOf(value.paths, isSimpleIdRecord)
    && isArrayOf(value.retrievalTraces, isSimpleIdRecord)
    && isArrayOf(value.contextPacks, isSimpleIdRecord)
    && isArrayOf(value.relations, isSimpleIdRecord)
  );
}
