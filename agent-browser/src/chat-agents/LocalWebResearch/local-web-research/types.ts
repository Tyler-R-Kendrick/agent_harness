export type AgentWorkflowStep =
  | 'planning'
  | 'searching'
  | 'extracting'
  | 'ranking'
  | 'synthesizing'
  | 'complete'
  | 'error';

export type AgentLogger = {
  debug?: (message: string, data?: unknown) => void;
  info?: (message: string, data?: unknown) => void;
  warn?: (message: string, data?: unknown) => void;
  error?: (message: string, data?: unknown) => void;
};

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type WebSearchProviderId =
  | 'searxng'
  | 'perplexity'
  | 'tavily'
  | 'duckduckgo-instant'
  | 'custom';

export type ConfiguredWebSearchProviderId = Exclude<WebSearchProviderId, 'custom'>;

export type SecretRefResolver = <T>(value: T) => Promise<T>;

export type Cache = {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
  delete?(key: string): Promise<void>;
};

export type WebResearchAgentConfig = {
  searxngBaseUrl?: string;
  searchProviderName?: ConfiguredWebSearchProviderId;
  perplexityApiKey?: string;
  tavilyApiKey?: string;
  defaultModel?: string;
  maxSearchResults?: number;
  maxPagesToExtract?: number;
  maxEvidenceChunks?: number;
  extractionTimeoutMs?: number;
  searchTimeoutMs?: number;
  allowPrivateUrlExtraction?: boolean;
  enableSynthesis?: boolean;
  searchCacheTtlMs?: number;
  extractCacheTtlMs?: number;
  cache?: Cache;
  searchProvider?: SearchProvider;
  resolveSecretRefs?: SecretRefResolver;
  extractor?: Extractor;
  synthesizer?: Synthesizer;
  logger?: AgentLogger;
};

export type WebResearchRunRequest = {
  question: string;
  retrievalStrategy?: 'baseline' | 'ppgr';
  queries?: string[];
  maxSearchResults?: number;
  maxPagesToExtract?: number;
  maxEvidenceChunks?: number;
  synthesize?: boolean;
  model?: string;
  language?: string;
  freshness?: 'any' | 'day' | 'week' | 'month' | 'year';
  safeSearch?: boolean;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
};

export type WebResearchRunResult = {
  id: string;
  question: string;
  plannedQueries: string[];
  searchResults: WebSearchResult[];
  extractedPages: ExtractedPage[];
  evidence: EvidenceChunk[];
  citations: AgentCitation[];
  answer?: string;
  errors: AgentErrorInfo[];
  timings: Partial<Record<AgentWorkflowStep, number>>;
  elapsedMs: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type WebSearchResult = {
  id: string;
  title: string;
  url: string;
  normalizedUrl: string;
  snippet?: string;
  provider: WebSearchProviderId;
  engine?: string;
  score?: number;
  rank: number;
  publishedDate?: string;
  metadata?: Record<string, unknown>;
};

export type ExtractedPage = {
  id: string;
  url: string;
  finalUrl?: string;
  normalizedUrl: string;
  title?: string;
  byline?: string;
  siteName?: string;
  excerpt?: string;
  text: string;
  length: number;
  fetchedAt: string;
  sourceResultId?: string;
};

export type EvidenceChunk = {
  id: string;
  url: string;
  normalizedUrl: string;
  title?: string;
  text: string;
  score: number;
  sourceResultId?: string;
  pageId?: string;
  citationId?: number;
  pageNumber?: number;
  pointerType?: 'figure' | 'table';
  pointerLabel?: string;
  pointerAnchor?: string;
};

export type AgentCitation = {
  id: number;
  kind?: 'text' | 'pointer';
  title?: string;
  url: string;
  normalizedUrl: string;
  quote?: string;
  docId?: string;
  page?: number;
  bbox?: { x: number; y: number; width: number; height: number };
  assetUri?: string;
  assetAnchor?: string;
  pageNumber?: number;
  pointerType?: 'figure' | 'table';
  pointerLabel?: string;
  pointerAnchor?: string;
};

export type AgentErrorInfo = {
  stage: AgentWorkflowStep;
  message: string;
  url?: string;
  cause?: string;
  recoverable: boolean;
};

export type SearchProvider = {
  id: string;
  search(request: {
    query: string;
    maxResults: number;
    language?: string;
    freshness?: 'any' | 'day' | 'week' | 'month' | 'year';
    safeSearch?: boolean;
    signal?: AbortSignal;
  }): Promise<WebSearchResult[]>;
};

export type Extractor = {
  extract(request: {
    url: string;
    sourceResultId?: string;
    timeoutMs: number;
    signal?: AbortSignal;
  }): Promise<ExtractedPage>;
  close?: () => Promise<void>;
};

export type Synthesizer = {
  synthesize(request: {
    question: string;
    evidence: EvidenceChunk[];
    citations: AgentCitation[];
    model?: string;
    signal?: AbortSignal;
  }): Promise<string>;
};
