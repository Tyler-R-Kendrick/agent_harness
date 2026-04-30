import type { MutableResearchGraph } from './graph/ResearchGraph';
import type { FrontierQueue } from './frontier/FrontierQueue';

export type ResearchObjective =
  | 'answer_question'
  | 'compare_options'
  | 'find_sources'
  | 'verify_claim'
  | 'build_brief'
  | 'collect_dataset';

export type ResearchTask = {
  id: string;
  question: string;
  objective: ResearchObjective;
  scope?: {
    domains?: string[];
    excludedDomains?: string[];
    languages?: string[];
    freshness?: 'any' | 'day' | 'week' | 'month' | 'year';
    region?: string;
  };
  successCriteria: string[];
};

export type ResearchBudget = {
  maxIterations: number;
  maxDepth: number;
  maxSearchQueries: number;
  maxFetchedPages: number;
  maxPagesPerDomain: number;
  maxRuntimeMs: number;
  maxFrontierSize: number;
  maxTargetsPerIteration: number;
  targetSufficiencyScore: number;
};

export type RecursiveResearchRequest = {
  question: string;
  objective?: ResearchObjective;
  successCriteria?: string[];
  scope?: ResearchTask['scope'];
  initialQueries?: string[];
  initialUrls?: string[];
  budget?: Partial<ResearchBudget>;
  synthesize?: boolean;
  model?: string;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
};

export type RecursiveResearchAgentConfig = {
  tools: ResearchToolset;
  defaults?: Partial<ResearchBudget>;
  gapAnalyzer?: GapAnalyzer;
  enableLinkFollowing?: boolean;
  enableSemanticExpansion?: boolean;
  enableSynthesis?: boolean;
  logger?: AgentLogger;
  onEvent?: (event: RecursiveResearchEvent) => void | Promise<void>;
};

export type AgentLogger = {
  debug?: (message: string, data?: unknown) => void;
  info?: (message: string, data?: unknown) => void;
  warn?: (message: string, data?: unknown) => void;
  error?: (message: string, data?: unknown) => void;
};

export type ResearchToolset = {
  webResearchAgent: WebResearchTool;
  semanticSearchAgent?: SemanticSearchTool;
  localIndexSearchAgent?: LocalIndexSearchTool;
  extractor?: ExtractorTool;
  synthesizer?: SynthesizerTool;
};

export type WebResearchTool = {
  run(request: {
    question: string;
    maxSearchResults?: number;
    maxPagesToExtract?: number;
    maxEvidenceChunks?: number;
    synthesize?: boolean;
    signal?: AbortSignal;
    metadata?: Record<string, unknown>;
  }): Promise<WebResearchToolResult>;
  extract?: (url: string, options?: { signal?: AbortSignal }) => Promise<ExtractedPageLike>;
};

export type SemanticSearchTool = {
  run(request: {
    question: string;
    maxResults?: number;
    signal?: AbortSignal;
    metadata?: Record<string, unknown>;
  }): Promise<SemanticSearchToolResult>;
};

export type LocalIndexSearchTool = {
  run(request: {
    question: string;
    maxResults?: number;
    signal?: AbortSignal;
    metadata?: Record<string, unknown>;
  }): Promise<WebResearchToolResult>;
};

export type ExtractorTool = {
  extract(request: {
    url: string;
    signal?: AbortSignal;
    metadata?: Record<string, unknown>;
  }): Promise<ExtractedPageLike>;
};

export type SynthesizerTool = {
  synthesize(request: {
    question: string;
    evidence: EvidenceItem[];
    citations: AgentCitation[];
    claims?: ResearchClaim[];
    gaps?: ResearchGap[];
    model?: string;
    signal?: AbortSignal;
  }): Promise<string>;
};

export type WebResearchToolResult = {
  searchResults?: Array<{
    id?: string;
    title: string;
    url: string;
    normalizedUrl?: string;
    snippet?: string;
    score?: number;
    rank?: number;
    provider?: string;
    engine?: string;
  }>;
  extractedPages?: ExtractedPageLike[];
  evidence?: Array<{
    id?: string;
    url: string;
    normalizedUrl?: string;
    title?: string;
    text: string;
    score?: number;
    citationId?: number;
  }>;
  citations?: AgentCitation[];
  answer?: string;
  errors?: Array<{
    stage?: string;
    message: string;
    url?: string;
    recoverable?: boolean;
  }>;
};

export type SemanticSearchToolResult = {
  results: Array<{
    id?: string;
    title: string;
    url: string;
    description?: string;
    source?: string;
    score?: number;
    raw?: unknown;
  }>;
  errors?: Array<{
    message: string;
    recoverable?: boolean;
  }>;
};

export type ExtractedPageLike = {
  id?: string;
  url: string;
  finalUrl?: string;
  normalizedUrl?: string;
  title?: string;
  text: string;
  length?: number;
  fetchedAt?: string;
};

export type AgentCitation = {
  id: number;
  title?: string;
  url: string;
  normalizedUrl?: string;
  quote?: string;
};

export type CrawlTargetKind =
  | 'search_query'
  | 'url'
  | 'domain_search'
  | 'entity_expand'
  | 'semantic_query'
  | 'local_index_query';

export type CrawlTargetBase = {
  id: string;
  kind: CrawlTargetKind;
  priority: number;
  depth: number;
  parentId?: string;
  reason: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type CrawlTarget =
  | (CrawlTargetBase & { kind: 'search_query'; query: string; provider?: 'web' | 'searxng' })
  | (CrawlTargetBase & { kind: 'url'; url: string })
  | (CrawlTargetBase & { kind: 'domain_search'; domain: string; query: string })
  | (CrawlTargetBase & { kind: 'entity_expand'; entity: string; source?: 'semantic' | 'web' })
  | (CrawlTargetBase & { kind: 'semantic_query'; query: string })
  | (CrawlTargetBase & { kind: 'local_index_query'; query: string });

export type VisitedResource = {
  id: string;
  targetId: string;
  kind: CrawlTargetKind;
  url?: string;
  normalizedUrl?: string;
  query?: string;
  depth: number;
  status: 'success' | 'failed' | 'skipped';
  reason?: string;
  visitedAt: string;
};

export type EvidenceItem = {
  id: string;
  url: string;
  normalizedUrl: string;
  title?: string;
  text: string;
  sourceType: 'web_page' | 'search_snippet' | 'semantic_result' | 'local_index' | 'pdf';
  discoveredByTargetId: string;
  depth: number;
  extractedAt: string;
  citationId?: number;
  quality: EvidenceQuality;
  metadata?: Record<string, unknown>;
};

export type EvidenceQuality = {
  relevance: number;
  authority: number;
  freshness: number;
  informationGain: number;
  overall: number;
};

export type ResearchGap = {
  id: string;
  description: string;
  priority: number;
  suggestedQueries: string[];
  suggestedDomains?: string[];
  suggestedUrls?: string[];
  reason: string;
  status: 'open' | 'addressed' | 'deferred';
};

export type ResearchClaim = {
  id: string;
  text: string;
  confidence: number;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  status: 'supported' | 'contradicted' | 'uncertain';
};

export type SufficiencyScore = {
  relevanceCoverage: number;
  sourceDiversity: number;
  freshnessCoverage: number;
  contradictionResolution: number;
  taskCompleteness: number;
  overall: number;
};

export type CrawlDecision =
  | { action: 'stop'; reason: string; confidence: number; sufficiency: SufficiencyScore }
  | { action: 'search_deeper'; reason: string; confidence: number; sufficiency: SufficiencyScore; nextTargets: CrawlTarget[] }
  | { action: 'fetch_more_from_existing_results'; reason: string; confidence: number; sufficiency: SufficiencyScore; nextTargets: CrawlTarget[] }
  | { action: 'change_strategy'; reason: string; confidence: number; sufficiency: SufficiencyScore; nextTargets: CrawlTarget[] };

export type CrawlDecisionLog = CrawlDecision & {
  id: string;
  iteration: number;
  createdAt: string;
};

export type ResearchGraphNode =
  | { id: string; type: 'task'; value: string; metadata?: Record<string, unknown> }
  | { id: string; type: 'target'; value: string; metadata?: Record<string, unknown> }
  | { id: string; type: 'query'; value: string; metadata?: Record<string, unknown> }
  | { id: string; type: 'url'; value: string; metadata?: Record<string, unknown> }
  | { id: string; type: 'evidence'; value: string; metadata?: Record<string, unknown> }
  | { id: string; type: 'claim'; value: string; metadata?: Record<string, unknown> }
  | { id: string; type: 'gap'; value: string; metadata?: Record<string, unknown> }
  | { id: string; type: 'entity'; value: string; metadata?: Record<string, unknown> };

export type ResearchGraphEdge = {
  id: string;
  from: string;
  to: string;
  type: 'spawned' | 'returned' | 'extracted' | 'supports' | 'contradicts' | 'mentions' | 'linked_to' | 'addresses_gap' | 'created_gap';
  metadata?: Record<string, unknown>;
};

export type ResearchGraph = {
  nodes: ResearchGraphNode[];
  edges: ResearchGraphEdge[];
};

export type RecursiveResearchResult = {
  id: string;
  task: ResearchTask;
  finalAnswer?: string;
  evidence: EvidenceItem[];
  citations: AgentCitation[];
  claims: ResearchClaim[];
  gaps: ResearchGap[];
  visited: VisitedResource[];
  frontierRemaining: CrawlTarget[];
  decisions: CrawlDecisionLog[];
  graph: ResearchGraph;
  errors: Array<{
    stage: 'planning' | 'executing_target' | 'ingesting' | 'gap_analysis' | 'decision' | 'synthesis' | 'finalize';
    message: string;
    targetId?: string;
    url?: string;
    recoverable: boolean;
  }>;
  metrics: {
    iterations: number;
    searchQueriesExecuted: number;
    urlsFetched: number;
    uniqueDomainsVisited: number;
    evidenceItems: number;
    sufficiency: SufficiencyScore;
  };
  elapsedMs: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type RecursiveResearchEvent =
  | { type: 'started'; task: ResearchTask }
  | { type: 'frontier_seeded'; targets: CrawlTarget[] }
  | { type: 'iteration_started'; iteration: number; targets: CrawlTarget[] }
  | { type: 'target_completed'; target: CrawlTarget; evidenceCount: number }
  | { type: 'target_failed'; target: CrawlTarget; error: string }
  | { type: 'gaps_updated'; gaps: ResearchGap[] }
  | { type: 'decision'; decision: CrawlDecisionLog }
  | { type: 'completed'; result: RecursiveResearchResult };

export type GapAnalyzer = {
  analyze(args: {
    task: ResearchTask;
    evidence: EvidenceItem[];
    claims: ResearchClaim[];
    previousGaps: ResearchGap[];
    budgetRemaining: Partial<ResearchBudget>;
    signal?: AbortSignal;
  }): Promise<{
    gaps: ResearchGap[];
    claims?: ResearchClaim[];
  }>;
};

export type ResearchState = {
  id: string;
  task: ResearchTask;
  budget: ResearchBudget;
  frontier: FrontierQueue;
  visited: VisitedResource[];
  evidence: EvidenceItem[];
  citations: AgentCitation[];
  claims: ResearchClaim[];
  gaps: ResearchGap[];
  decisions: CrawlDecisionLog[];
  graph: MutableResearchGraph;
  errors: RecursiveResearchResult['errors'];
  counters: {
    iterations: number;
    searchQueriesExecuted: number;
    urlsFetched: number;
  };
  startedAt: number;
  deadlineAt: number;
  metadata?: Record<string, unknown>;
};
