export type MemoryGraphNodeKind = 'Document' | 'Chunk' | 'Entity' | 'Claim' | 'Topic' | 'Memory';

export type MemoryGraphRelationshipType =
  | 'HAS_CHUNK'
  | 'MENTIONS'
  | 'SUPPORTS'
  | 'ABOUT'
  | 'RELATED_TO'
  | 'DERIVED_FROM'
  | 'SUMMARIZES'
  | 'CONNECTS'
  | 'NEXT_CHUNK'
  | 'SIMILAR_TO'
  | 'CONTRADICTS'
  | 'SUPPORTS_CLAIM';

export interface MemoryGraphDocument {
  id: string;
  title: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryGraphChunk {
  id: string;
  documentId: string;
  text: string;
  tokenEstimate: number;
  order: number;
  createdAt: string;
}

export interface MemoryGraphEntity {
  id: string;
  name: string;
  type: string;
  aliases: string[];
}

export interface MemoryGraphClaim {
  id: string;
  text: string;
  confidence: number;
  createdAt: string;
}

export interface MemoryGraphTopic {
  id: string;
  name: string;
}

export interface MemoryGraphMemory {
  id: string;
  summary: string;
  importance: number;
  lastAccessedAt: string;
  createdAt: string;
}

export interface MemoryGraphRelationship {
  id: string;
  type: MemoryGraphRelationshipType;
  sourceId: string;
  targetId: string;
  weight: number;
}

export interface PersistentMemoryGraphState {
  version: 'persistent-memory-graph/v1';
  engine: {
    name: 'kuzu-wasm-compatible-local-graph';
    status: 'ready' | 'error';
    workerBoundary: boolean;
    persistence: 'local-json';
  };
  initializedAt: string;
  updatedAt: string;
  documents: MemoryGraphDocument[];
  chunks: MemoryGraphChunk[];
  entities: MemoryGraphEntity[];
  claims: MemoryGraphClaim[];
  topics: MemoryGraphTopic[];
  memories: MemoryGraphMemory[];
  relationships: MemoryGraphRelationship[];
  errors: string[];
}

export interface MemoryGraphIngestInput {
  title: string;
  source: string;
  text: string;
  now?: string;
}

export interface MemoryGraphRetrievalOptions {
  maxDepth?: number;
  maxPaths?: number;
  maxChunks?: number;
}

export interface MemoryGraphPathNode {
  id: string;
  type: MemoryGraphNodeKind;
  label: string;
}

export interface MemoryGraphPath {
  id: string;
  nodes: MemoryGraphPathNode[];
  relationships: MemoryGraphRelationshipType[];
  score: number;
  explanation: string;
}

export interface MemoryGraphSubgraphNode extends MemoryGraphPathNode {
  score: number;
}

export interface MemoryGraphSubgraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: MemoryGraphRelationshipType;
}

export interface MemoryGraphSubgraph {
  nodes: MemoryGraphSubgraphNode[];
  edges: MemoryGraphSubgraphEdge[];
}

export interface MemoryGraphRetrievalResult {
  question: string;
  queryTerms: string[];
  chunks: MemoryGraphChunk[];
  entities: MemoryGraphEntity[];
  claims: MemoryGraphClaim[];
  topics: MemoryGraphTopic[];
  memories: MemoryGraphMemory[];
  paths: MemoryGraphPath[];
  contextBlock: string;
  subgraph: MemoryGraphSubgraph;
  scoreBreakdown: Record<string, number>;
}

export interface MemoryGraphQueryResult {
  columns: string[];
  rows: Array<Record<string, string | number>>;
  graph: MemoryGraphSubgraph;
  raw: string;
}

interface ExtractedMemorySignals {
  entities: MemoryGraphEntity[];
  claims: MemoryGraphClaim[];
  topics: MemoryGraphTopic[];
}

const DOMAIN_TERMS = [
  'Azure AI Search',
  'Kuzu-WASM',
  'GraphRAG',
  'PathRAG',
  'IndexedDB',
  'Web Worker',
  'Static Web App',
  'Agent Browser',
  'Local Persistence',
  'Graph Traversal',
];

const CLAIM_VERBS = [
  'is',
  'are',
  'enables',
  'requires',
  'improves',
  'causes',
  'supports',
  'reduces',
  'increases',
  'depends on',
  'connects',
];

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'into',
  'about',
  'does',
  'help',
  'how',
  'why',
  'what',
  'when',
  'where',
  'user',
  'users',
]);

export const SAMPLE_MEMORY_TEXT = [
  'Azure AI Search improves retrieval for enterprise knowledge search when lexical and structured evidence are combined.',
  'Kuzu-WASM enables offline graph traversal inside a Web Worker so Agent Browser can query memory without a backend.',
  'GraphRAG connects evidence chunks to claims, topics, and entities for prompt-ready context.',
  'PathRAG explains why memories were retrieved by ranking short paths through entities, claims, and local persistence.',
  'IndexedDB local persistence enables offline workflows after the static app loads once.',
  'Graph traversal improves explainability because selected evidence can be traced back to documents and claims.',
].join(' ');

export const EMPTY_PERSISTENT_MEMORY_GRAPH: PersistentMemoryGraphState = createPersistentMemoryGraphState(
  '2026-05-08T00:00:00.000Z',
);

export function createPersistentMemoryGraphState(now = new Date().toISOString()): PersistentMemoryGraphState {
  return {
    version: 'persistent-memory-graph/v1',
    engine: {
      name: 'kuzu-wasm-compatible-local-graph',
      status: 'ready',
      workerBoundary: true,
      persistence: 'local-json',
    },
    initializedAt: now,
    updatedAt: now,
    documents: [],
    chunks: [],
    entities: [],
    claims: [],
    topics: [],
    memories: [],
    relationships: [],
    errors: [],
  };
}

export function isPersistentMemoryGraphState(value: unknown): value is PersistentMemoryGraphState {
  if (!isRecord(value)) return false;
  return (
    value.version === 'persistent-memory-graph/v1'
    && isRecord(value.engine)
    && value.engine.name === 'kuzu-wasm-compatible-local-graph'
    && (value.engine.status === 'ready' || value.engine.status === 'error')
    && value.engine.workerBoundary === true
    && value.engine.persistence === 'local-json'
    && typeof value.initializedAt === 'string'
    && typeof value.updatedAt === 'string'
    && isArrayOf(value.documents, isDocument)
    && isArrayOf(value.chunks, isChunk)
    && isArrayOf(value.entities, isEntity)
    && isArrayOf(value.claims, isClaim)
    && isArrayOf(value.topics, isTopic)
    && isArrayOf(value.memories, isMemory)
    && isArrayOf(value.relationships, isRelationship)
    && isArrayOf(value.errors, isString)
  );
}

export function loadSampleMemoryGraph(now = new Date().toISOString()): PersistentMemoryGraphState {
  return ingestTextToMemoryGraph(createPersistentMemoryGraphState(now), {
    title: 'Enterprise AI graph memory architecture',
    source: 'sample-memory',
    text: SAMPLE_MEMORY_TEXT,
    now,
  });
}

export function ingestTextToMemoryGraph(
  state: PersistentMemoryGraphState,
  input: MemoryGraphIngestInput,
): PersistentMemoryGraphState {
  const now = input.now ?? new Date().toISOString();
  const title = input.title.trim() || 'Untitled memory document';
  const source = input.source.trim() || 'manual';
  const document: MemoryGraphDocument = {
    id: nextId('D', state.documents.length + 1),
    title,
    source,
    createdAt: now,
    updatedAt: now,
  };
  const chunkTexts = chunkText(input.text);
  const chunks = chunkTexts.map((text, index): MemoryGraphChunk => ({
    id: nextId('C', state.chunks.length + index + 1),
    documentId: document.id,
    text,
    tokenEstimate: estimateTokens(text),
    order: index,
    createdAt: now,
  }));
  const signals = extractSignals(input.text, state, now);
  const entities = mergeEntities(state.entities, signals.entities);
  const topics = mergeTopics(state.topics, signals.topics);
  const claims = mergeClaims(state.claims, signals.claims);
  const memory: MemoryGraphMemory = {
    id: nextId('M', state.memories.length + 1),
    summary: `${title}: ${summarizeText(input.text)}`,
    importance: scoreMemoryImportance(input.text),
    lastAccessedAt: now,
    createdAt: now,
  };
  const relationships = [
    ...state.relationships,
    ...buildRelationships({
      document,
      chunks,
      entities,
      claims,
      topics,
      memory,
    }),
  ];
  return {
    ...state,
    updatedAt: now,
    documents: [...state.documents, document],
    chunks: [...state.chunks, ...chunks],
    entities,
    claims,
    topics,
    memories: [...state.memories, memory],
    relationships: uniqueRelationships(relationships),
  };
}

export function searchPersistentMemoryGraph(
  state: PersistentMemoryGraphState,
  question: string,
  options: MemoryGraphRetrievalOptions = {},
): MemoryGraphRetrievalResult {
  const queryTerms = tokenize(question);
  const chunkScores = state.chunks
    .map((chunk) => ({ item: chunk, score: scoreText(chunk.text, queryTerms) + relatedNodeScore(state, chunk.id, queryTerms) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.item.order - right.item.order);
  const chunks = chunkScores.slice(0, options.maxChunks ?? 6).map(({ item }) => item);
  const seedIds = new Set(chunks.map((chunk) => chunk.id));
  const entities = selectConnectedEntities(state, seedIds, queryTerms);
  const claims = selectConnectedClaims(state, seedIds, queryTerms);
  const topics = selectConnectedTopics(state, seedIds, queryTerms);
  const memories = selectConnectedMemories(state, seedIds, queryTerms);
  const paths = retrievePathsForQuestion(state, question, options);
  const subgraph = buildSubgraph(state, [
    ...chunks.map((chunk) => chunk.id),
    ...entities.map((entity) => entity.id),
    ...claims.map((claim) => claim.id),
    ...topics.map((topic) => topic.id),
    ...memories.map((memory) => memory.id),
    ...paths.flatMap((path) => path.nodes.map((node) => node.id)),
  ], queryTerms);
  const resultWithoutContext: Omit<MemoryGraphRetrievalResult, 'contextBlock'> = {
    question,
    queryTerms,
    chunks,
    entities,
    claims,
    topics,
    memories,
    paths,
    subgraph,
    scoreBreakdown: {
      lexicalScore: sum(chunkScores.map(({ score }) => score)),
      entityScore: entities.length,
      topicScore: topics.length,
      pathScore: sum(paths.map((path) => path.score)),
      importanceScore: sum(memories.map((memory) => memory.importance)),
    },
  };
  const result = {
    ...resultWithoutContext,
    contextBlock: '',
  };
  result.contextBlock = buildRagContext(result);
  return result;
}

export function retrievePathsForQuestion(
  state: PersistentMemoryGraphState,
  question: string,
  options: MemoryGraphRetrievalOptions = {},
): MemoryGraphPath[] {
  const queryTerms = tokenize(question);
  const maxDepth = Math.max(1, Math.min(options.maxDepth ?? 3, 4));
  const seeds = [
    ...state.entities.filter((entity) => scoreEntity(entity, queryTerms) > 0).map((entity) => entity.id),
    ...state.topics.filter((topic) => scoreText(topic.name, queryTerms) > 0).map((topic) => topic.id),
    ...state.chunks.filter((chunk) => scoreText(chunk.text, queryTerms) > 0).map((chunk) => chunk.id),
  ];
  const paths = uniqueStrings(seeds)
    .flatMap((seedId) => expandPathsFromSeed(state, seedId, maxDepth, queryTerms))
    .sort((left, right) => right.score - left.score || left.nodes.length - right.nodes.length);
  return uniquePathsById(paths).slice(0, options.maxPaths ?? 5);
}

export function buildRagContext(result: MemoryGraphRetrievalResult): string {
  const lines = [
    'MEMORY SUMMARY',
    ...(result.memories.length > 0
      ? result.memories.map((memory) => `- ${memory.id}: ${memory.summary} Importance: ${memory.importance.toFixed(2)}.`)
      : ['- No matching durable memories found.']),
    '',
    'RELEVANT EVIDENCE',
    ...(result.chunks.length > 0
      ? result.chunks.map((chunk) => `- [Chunk ${chunk.id}, Document ${chunk.documentId}] ${chunk.text}`)
      : ['- No matching chunks found.']),
    '',
    'CLAIMS',
    ...(result.claims.length > 0
      ? result.claims.map((claim) => `- [Claim ${claim.id}, confidence ${claim.confidence.toFixed(2)}] ${claim.text}`)
      : ['- No matching claims found.']),
    '',
    'ENTITIES AND TOPICS',
    `- Entities: ${result.entities.map((entity) => entity.name).join(', ') || 'none'}`,
    `- Topics: ${result.topics.map((topic) => topic.name).join(', ') || 'none'}`,
    '',
    'RELEVANT PATHS',
    ...(result.paths.length > 0
      ? result.paths.map((path, index) => `${index + 1}. ${path.nodes.map((node) => `${node.type}: ${node.label}`).join(' -> ')}. ${path.explanation}`)
      : ['1. No ranked paths were found for this question.']),
  ];
  return lines.join('\n');
}

export function runMemoryGraphQuery(state: PersistentMemoryGraphState, query: string): MemoryGraphQueryResult {
  const normalized = query.replace(/\s+/g, ' ').trim().toLowerCase();
  if (normalized.includes('document') && normalized.includes('has_chunk')) {
    const rows = state.chunks.map((chunk) => {
      const document = state.documents.find((candidate) => candidate.id === chunk.documentId);
      return { 'd.title': document?.title ?? '', 'c.id': chunk.id, 'c.text': chunk.text };
    });
    return { columns: ['d.title', 'c.id', 'c.text'], rows, graph: buildSubgraph(state, state.chunks.map((chunk) => chunk.id), []), raw: query };
  }
  if (normalized.includes('mentions')) {
    const rows = state.relationships
      .filter((relationship) => relationship.type === 'MENTIONS')
      .flatMap((relationship) => {
        const chunk = state.chunks.find((candidate) => candidate.id === relationship.sourceId);
        const entity = state.entities.find((candidate) => candidate.id === relationship.targetId);
        return chunk && entity ? [{ 'c.id': chunk.id, 'c.text': chunk.text, 'e.name': entity.name, 'e.type': entity.type }] : [];
      });
    return {
      columns: ['c.id', 'c.text', 'e.name', 'e.type'],
      rows,
      graph: buildSubgraph(state, rows.flatMap((row) => [String(row['c.id']), entityIdByName(state, String(row['e.name']))]).filter(Boolean), []),
      raw: query,
    };
  }
  if (normalized.includes('supports')) {
    const rows = state.relationships
      .filter((relationship) => relationship.type === 'SUPPORTS')
      .flatMap((relationship) => {
        const chunk = state.chunks.find((candidate) => candidate.id === relationship.sourceId);
        const claim = state.claims.find((candidate) => candidate.id === relationship.targetId);
        return chunk && claim ? [{ 'c.id': chunk.id, 'claim.text': claim.text, 'claim.confidence': claim.confidence }] : [];
      });
    return { columns: ['c.id', 'claim.text', 'claim.confidence'], rows, graph: buildSubgraph(state, rows.map((row) => String(row['c.id'])), []), raw: query };
  }
  if (normalized.includes('memory') || normalized.includes('derived_from')) {
    const rows = state.memories.map((memory) => ({ 'm.summary': memory.summary, 'm.id': memory.id, 'm.importance': memory.importance }));
    return { columns: ['m.summary', 'm.id', 'm.importance'], rows, graph: buildSubgraph(state, state.memories.map((memory) => memory.id), []), raw: query };
  }
  return {
    columns: ['type', 'count'],
    rows: [
      { type: 'Document', count: state.documents.length },
      { type: 'Chunk', count: state.chunks.length },
      { type: 'Entity', count: state.entities.length },
      { type: 'Claim', count: state.claims.length },
      { type: 'Topic', count: state.topics.length },
      { type: 'Memory', count: state.memories.length },
    ],
    graph: buildSubgraph(state, [], []),
    raw: query,
  };
}

export function exportPersistentMemoryGraph(state: PersistentMemoryGraphState): string {
  return JSON.stringify(state, null, 2);
}

export function importPersistentMemoryGraph(serialized: string): PersistentMemoryGraphState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    throw new Error(`Invalid memory graph JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isPersistentMemoryGraphState(parsed)) {
    throw new Error('Invalid memory graph JSON: payload does not match persistent-memory-graph/v1.');
  }
  return parsed;
}

function buildRelationships({
  document,
  chunks,
  entities,
  claims,
  topics,
  memory,
}: {
  document: MemoryGraphDocument;
  chunks: MemoryGraphChunk[];
  entities: MemoryGraphEntity[];
  claims: MemoryGraphClaim[];
  topics: MemoryGraphTopic[];
  memory: MemoryGraphMemory;
}): MemoryGraphRelationship[] {
  const relationships: MemoryGraphRelationship[] = [];
  chunks.forEach((chunk, index) => {
    relationships.push(createRelationship('HAS_CHUNK', document.id, chunk.id, 1));
    if (index > 0) relationships.push(createRelationship('NEXT_CHUNK', chunks[index - 1].id, chunk.id, 0.5));
    entities.filter((entity) => textContainsAny(chunk.text, [entity.name, ...entity.aliases]))
      .forEach((entity) => relationships.push(createRelationship('MENTIONS', chunk.id, entity.id, 0.9)));
    claims.filter((claim) => chunk.text.includes(claim.text) || scoreText(chunk.text, tokenize(claim.text)) >= 2)
      .forEach((claim) => relationships.push(createRelationship('SUPPORTS', chunk.id, claim.id, claim.confidence)));
    topics.filter((topic) => scoreText(chunk.text, tokenize(topic.name)) > 0)
      .forEach((topic) => relationships.push(createRelationship('ABOUT', chunk.id, topic.id, 0.7)));
    relationships.push(createRelationship('DERIVED_FROM', memory.id, chunk.id, 0.75));
  });
  relationships.push(createRelationship('SUMMARIZES', memory.id, document.id, 0.8));
  entities
    .filter((entity) => chunks.some((chunk) => textContainsAny(chunk.text, [entity.name, ...entity.aliases])))
    .forEach((entity) => relationships.push(createRelationship('CONNECTS', memory.id, entity.id, 0.7)));
  for (let index = 0; index < entities.length - 1; index += 1) {
    relationships.push(createRelationship('RELATED_TO', entities[index].id, entities[index + 1].id, 0.35));
  }
  return relationships;
}

function extractSignals(text: string, state: PersistentMemoryGraphState, now: string): ExtractedMemorySignals {
  const sentences = splitSentences(text);
  const entityNames = uniqueStrings([
    ...DOMAIN_TERMS.filter((term) => textContainsAny(text, [term])),
    ...Array.from(text.matchAll(/\b[A-Z][A-Za-z0-9-]+(?:\s+[A-Z][A-Za-z0-9-]+)+\b/g)).map((match) => match[0]),
    ...Array.from(text.matchAll(/\b[A-Z]{2,}(?:-[A-Z]+)?\b/g)).map((match) => match[0]),
  ]);
  const entities = entityNames.map((name, index): MemoryGraphEntity => ({
    id: existingEntityId(state, name) ?? nextId('E', state.entities.length + index + 1),
    name,
    type: inferEntityType(name),
    aliases: buildAliases(name),
  }));
  const claims = sentences
    .filter((sentence) => CLAIM_VERBS.some((verb) => new RegExp(`\\b${escapeRegExp(verb)}\\b`, 'i').test(sentence)))
    .map((sentence, index): MemoryGraphClaim => ({
      id: existingClaimId(state, sentence) ?? nextId('CL', state.claims.length + index + 1),
      text: sentence,
      confidence: Math.min(0.92, 0.64 + (tokenize(sentence).length / 100)),
      createdAt: now,
    }));
  const topicNames = uniqueStrings([
    ...DOMAIN_TERMS.filter((term) => textContainsAny(text, [term])).map((term) => term.toLowerCase()),
    ...topTerms(text, 8),
  ]).slice(0, 12);
  const topics = topicNames.map((name, index): MemoryGraphTopic => ({
    id: existingTopicId(state, name) ?? nextId('T', state.topics.length + index + 1),
    name,
  }));
  return { entities, claims, topics };
}

function expandPathsFromSeed(
  state: PersistentMemoryGraphState,
  seedId: string,
  maxDepth: number,
  queryTerms: string[],
): MemoryGraphPath[] {
  const paths: MemoryGraphPath[] = [];
  const queue: Array<{ ids: string[]; rels: MemoryGraphRelationship[] }> = [{ ids: [seedId], rels: [] }];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const lastId = current.ids[current.ids.length - 1];
    if (current.rels.length >= maxDepth) {
      paths.push(pathFromIds(state, current.ids, current.rels, queryTerms));
      continue;
    }
    const nextRelationships = state.relationships.filter((relationship) => (
      relationship.sourceId === lastId || relationship.targetId === lastId
    ));
    for (const relationship of nextRelationships) {
      const nextId = relationship.sourceId === lastId ? relationship.targetId : relationship.sourceId;
      if (current.ids.includes(nextId)) continue;
      const nextPath = { ids: [...current.ids, nextId], rels: [...current.rels, relationship] };
      if (nextPath.ids.length >= 3) paths.push(pathFromIds(state, nextPath.ids, nextPath.rels, queryTerms));
      queue.push(nextPath);
    }
  }
  return paths.filter((path) => path.nodes.length > 1 && path.score > 0);
}

function uniquePathsById(paths: MemoryGraphPath[]): MemoryGraphPath[] {
  const seen = new Set<string>();
  return paths.filter((path) => {
    if (seen.has(path.id)) return false;
    seen.add(path.id);
    return true;
  });
}

function pathFromIds(
  state: PersistentMemoryGraphState,
  ids: string[],
  relationships: MemoryGraphRelationship[],
  queryTerms: string[],
): MemoryGraphPath {
  const nodes = ids.map((id) => nodeForId(state, id)).filter((node): node is MemoryGraphPathNode => Boolean(node));
  const textScore = scoreText(nodes.map((node) => node.label).join(' '), queryTerms);
  const relationshipScore = sum(relationships.map((relationship) => relationship.weight));
  const pathLengthPenalty = Math.max(0, nodes.length - 2) * 0.18;
  const importance = nodes
    .map((node) => state.memories.find((memory) => memory.id === node.id)?.importance ?? 0)
    .reduce((total, value) => total + value, 0);
  const score = roundScore(textScore + relationshipScore + importance - pathLengthPenalty);
  const matched = queryTerms.filter((term) => nodes.some((node) => tokenize(node.label).includes(term)));
  return {
    id: `path:${ids.join('>')}`,
    nodes,
    relationships: relationships.map((relationship) => relationship.type),
    score,
    explanation: `The question matched ${matched.length > 0 ? matched.join(', ') : 'nearby graph evidence'}; this path was selected because it connects ${nodes[0]?.label ?? 'a seed'} to ${nodes.at(-1)?.label ?? 'supporting memory'} through ${relationships.map((relationship) => relationship.type).join(', ')}.`,
  };
}

function buildSubgraph(state: PersistentMemoryGraphState, ids: string[], queryTerms: string[]): MemoryGraphSubgraph {
  const wantedIds = new Set(ids);
  const expandedRelationships = state.relationships.filter((relationship) => (
    wantedIds.has(relationship.sourceId) || wantedIds.has(relationship.targetId)
  ));
  expandedRelationships.forEach((relationship) => {
    wantedIds.add(relationship.sourceId);
    wantedIds.add(relationship.targetId);
  });
  const nodes = Array.from(wantedIds)
    .map((id): MemoryGraphSubgraphNode | null => {
      const node = nodeForId(state, id);
      return node ? { ...node, score: scoreText(node.label, queryTerms) } : null;
    })
    .filter((node): node is MemoryGraphSubgraphNode => Boolean(node));
  const edges = expandedRelationships
    .filter((relationship) => wantedIds.has(relationship.sourceId) && wantedIds.has(relationship.targetId))
    .map((relationship) => ({
      id: relationship.id,
      sourceId: relationship.sourceId,
      targetId: relationship.targetId,
      type: relationship.type,
    }));
  return { nodes, edges };
}

function selectConnectedEntities(
  state: PersistentMemoryGraphState,
  seedIds: Set<string>,
  queryTerms: string[],
): MemoryGraphEntity[] {
  return state.entities
    .filter((entity) => scoreEntity(entity, queryTerms) > 0 || isConnectedToSeeds(state, entity.id, seedIds))
    .slice(0, 8);
}

function selectConnectedClaims(
  state: PersistentMemoryGraphState,
  seedIds: Set<string>,
  queryTerms: string[],
): MemoryGraphClaim[] {
  return state.claims
    .filter((claim) => scoreText(claim.text, queryTerms) > 0 || isConnectedToSeeds(state, claim.id, seedIds))
    .slice(0, 6);
}

function selectConnectedTopics(
  state: PersistentMemoryGraphState,
  seedIds: Set<string>,
  queryTerms: string[],
): MemoryGraphTopic[] {
  return state.topics
    .filter((topic) => scoreText(topic.name, queryTerms) > 0 || isConnectedToSeeds(state, topic.id, seedIds))
    .slice(0, 8);
}

function selectConnectedMemories(
  state: PersistentMemoryGraphState,
  seedIds: Set<string>,
  queryTerms: string[],
): MemoryGraphMemory[] {
  return state.memories
    .filter((memory) => scoreText(memory.summary, queryTerms) > 0 || isConnectedToSeeds(state, memory.id, seedIds))
    .sort((left, right) => right.importance - left.importance)
    .slice(0, 4);
}

function isConnectedToSeeds(state: PersistentMemoryGraphState, id: string, seedIds: Set<string>): boolean {
  return state.relationships.some((relationship) => (
    (relationship.sourceId === id && seedIds.has(relationship.targetId))
    || (relationship.targetId === id && seedIds.has(relationship.sourceId))
  ));
}

function relatedNodeScore(state: PersistentMemoryGraphState, id: string, queryTerms: string[]): number {
  return state.relationships
    .filter((relationship) => relationship.sourceId === id || relationship.targetId === id)
    .map((relationship) => relationship.sourceId === id ? relationship.targetId : relationship.sourceId)
    .map((nodeId) => nodeForId(state, nodeId)?.label ?? '')
    .reduce((total, label) => total + (scoreText(label, queryTerms) * 0.4), 0);
}

function nodeForId(state: PersistentMemoryGraphState, id: string): MemoryGraphPathNode | null {
  const document = state.documents.find((candidate) => candidate.id === id);
  if (document) return { id, type: 'Document', label: document.title };
  const chunk = state.chunks.find((candidate) => candidate.id === id);
  if (chunk) return { id, type: 'Chunk', label: chunk.text };
  const entity = state.entities.find((candidate) => candidate.id === id);
  if (entity) return { id, type: 'Entity', label: entity.name };
  const claim = state.claims.find((candidate) => candidate.id === id);
  if (claim) return { id, type: 'Claim', label: claim.text };
  const topic = state.topics.find((candidate) => candidate.id === id);
  if (topic) return { id, type: 'Topic', label: topic.name };
  const memory = state.memories.find((candidate) => candidate.id === id);
  if (memory) return { id, type: 'Memory', label: memory.summary };
  return null;
}

function mergeEntities(existing: MemoryGraphEntity[], next: MemoryGraphEntity[]): MemoryGraphEntity[] {
  const merged = [...existing];
  for (const entity of next) {
    if (merged.some((candidate) => normalize(candidate.name) === normalize(entity.name))) continue;
    merged.push(entity);
  }
  return merged;
}

function mergeTopics(existing: MemoryGraphTopic[], next: MemoryGraphTopic[]): MemoryGraphTopic[] {
  const merged = [...existing];
  for (const topic of next) {
    if (merged.some((candidate) => normalize(candidate.name) === normalize(topic.name))) continue;
    merged.push(topic);
  }
  return merged;
}

function mergeClaims(existing: MemoryGraphClaim[], next: MemoryGraphClaim[]): MemoryGraphClaim[] {
  const merged = [...existing];
  for (const claim of next) {
    if (merged.some((candidate) => normalize(candidate.text) === normalize(claim.text))) continue;
    merged.push(claim);
  }
  return merged;
}

function createRelationship(
  type: MemoryGraphRelationshipType,
  sourceId: string,
  targetId: string,
  weight: number,
): MemoryGraphRelationship {
  return { id: `${type}:${sourceId}:${targetId}`, type, sourceId, targetId, weight };
}

function uniqueRelationships(relationships: MemoryGraphRelationship[]): MemoryGraphRelationship[] {
  const seen = new Set<string>();
  return relationships.filter((relationship) => {
    if (seen.has(relationship.id)) return false;
    seen.add(relationship.id);
    return true;
  });
}

function chunkText(text: string): string[] {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return [];
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    const candidate = `${current} ${sentence}`.trim();
    if (estimateTokens(candidate) > 48 && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function topTerms(text: string, limit: number): string[] {
  const counts = new Map<string, number>();
  tokenize(text).forEach((token) => counts.set(token, (counts.get(token) ?? 0) + 1));
  return Array.from(counts)
    .filter(([term, count]) => count > 1 || ['retrieval', 'offline', 'memory', 'graph', 'persistence'].includes(term))
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([term]) => term);
}

function scoreText(text: string, queryTerms: string[]): number {
  if (queryTerms.length === 0) return 0;
  const tokens = tokenize(text);
  return queryTerms.reduce((score, term) => score + (tokens.includes(term) ? 1 : 0), 0);
}

function scoreEntity(entity: MemoryGraphEntity, queryTerms: string[]): number {
  return scoreText([entity.name, ...entity.aliases].join(' '), queryTerms);
}

function scoreMemoryImportance(text: string): number {
  const domainMatches = DOMAIN_TERMS.filter((term) => textContainsAny(text, [term])).length;
  return roundScore(Math.min(0.95, 0.55 + (domainMatches * 0.05) + (splitSentences(text).length * 0.02)));
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3));
}

function summarizeText(text: string): string {
  const sentence = splitSentences(text)[0] ?? text.trim();
  return sentence.length > 140 ? `${sentence.slice(0, 137).trim()}...` : sentence;
}

function inferEntityType(name: string): string {
  if (/wasm|indexeddb|worker|app/i.test(name)) return 'technology';
  if (/search|graphrag|pathrag|retrieval/i.test(name)) return 'concept';
  return 'entity';
}

function buildAliases(name: string): string[] {
  const aliases = [name.toLowerCase()];
  const acronym = name.match(/\b[A-Z][A-Za-z0-9-]*/g)?.map((part) => part[0]).join('');
  if (acronym && acronym.length > 1) aliases.push(acronym);
  return uniqueStrings(aliases);
}

function existingEntityId(state: PersistentMemoryGraphState, name: string): string | null {
  return state.entities.find((entity) => normalize(entity.name) === normalize(name))?.id ?? null;
}

function existingTopicId(state: PersistentMemoryGraphState, name: string): string | null {
  return state.topics.find((topic) => normalize(topic.name) === normalize(name))?.id ?? null;
}

function existingClaimId(state: PersistentMemoryGraphState, text: string): string | null {
  return state.claims.find((claim) => normalize(claim.text) === normalize(text))?.id ?? null;
}

function entityIdByName(state: PersistentMemoryGraphState, name: string): string {
  return state.entities.find((entity) => normalize(entity.name) === normalize(name))?.id ?? '';
}

function textContainsAny(text: string, values: string[]): boolean {
  const normalizedText = normalize(text);
  return values.some((value) => normalizedText.includes(normalize(value)));
}

function uniqueStrings(values: string[]): string[] {
  return values.map((value) => value.trim()).filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function nextId(prefix: string, index: number): string {
  return `${prefix}${String(index).padStart(2, '0')}`;
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function sum(values: number[]): number {
  return roundScore(values.reduce((total, value) => total + value, 0));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArrayOf<T>(value: unknown, validate: (entry: unknown) => entry is T): value is T[] {
  return Array.isArray(value) && value.every(validate);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isDocument(value: unknown): value is MemoryGraphDocument {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.source === 'string'
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string';
}

function isChunk(value: unknown): value is MemoryGraphChunk {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.documentId === 'string'
    && typeof value.text === 'string'
    && typeof value.tokenEstimate === 'number'
    && typeof value.order === 'number'
    && typeof value.createdAt === 'string';
}

function isEntity(value: unknown): value is MemoryGraphEntity {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.type === 'string'
    && isArrayOf(value.aliases, isString);
}

function isClaim(value: unknown): value is MemoryGraphClaim {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.text === 'string'
    && typeof value.confidence === 'number'
    && typeof value.createdAt === 'string';
}

function isTopic(value: unknown): value is MemoryGraphTopic {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string';
}

function isMemory(value: unknown): value is MemoryGraphMemory {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.summary === 'string'
    && typeof value.importance === 'number'
    && typeof value.lastAccessedAt === 'string'
    && typeof value.createdAt === 'string';
}

function isRelationship(value: unknown): value is MemoryGraphRelationship {
  return isRecord(value)
    && typeof value.id === 'string'
    && isMemoryGraphRelationshipType(value.type)
    && typeof value.sourceId === 'string'
    && typeof value.targetId === 'string'
    && typeof value.weight === 'number';
}

function isMemoryGraphRelationshipType(value: unknown): value is MemoryGraphRelationshipType {
  return typeof value === 'string' && [
    'HAS_CHUNK',
    'MENTIONS',
    'SUPPORTS',
    'ABOUT',
    'RELATED_TO',
    'DERIVED_FROM',
    'SUMMARIZES',
    'CONNECTS',
    'NEXT_CHUNK',
    'SIMILAR_TO',
    'CONTRADICTS',
    'SUPPORTS_CLAIM',
  ].includes(value);
}
