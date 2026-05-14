import { mapWithConcurrency } from './concurrency';
import { FetchPageExtractor } from './extractor';
import { stableHash } from './hash';
import { normalizeUrl } from './normalizeUrl';
import { planSearchQueries } from './planSearchQueries';
import { runPpgrStrategy } from './ppgr/strategy';
import { createSearchProviderFromConfig } from './searchProviders';
import { resolveRetrievalStrategy } from './retrievalStrategy';
import type {
  AgentErrorInfo,
  AgentWorkflowStep,
  ExtractedPage,
  WebResearchAgentConfig,
  WebResearchRunRequest,
  WebResearchRunResult,
  WebSearchResult,
} from './types';

const DEFAULTS = {
  maxSearchResults: 10,
  maxPagesToExtract: 5,
  maxEvidenceChunks: 8,
  maxPointerBudget: 8,
  searchTimeoutMs: 15_000,
  extractionTimeoutMs: 15_000,
  defaultModel: 'llama3.1:8b',
  searchCacheTtlMs: 10 * 60 * 1000,
  extractCacheTtlMs: 24 * 60 * 60 * 1000,
};

export class LocalWebResearchAgent {
  private readonly config: WebResearchAgentConfig;

  constructor(config: WebResearchAgentConfig = {}) {
    this.config = config;
  }

  async run(request: WebResearchRunRequest): Promise<WebResearchRunResult> {
    const started = Date.now();
    const timings: Partial<Record<AgentWorkflowStep, number>> = {};
    const createdAt = new Date(started).toISOString();
    const question = request.question.trim();
    if (!question && (!request.queries || request.queries.length === 0)) {
      throw new TypeError('LocalWebResearchAgent.run requires a question or explicit queries.');
    }

    const plannedQueries = timeStage(timings, 'planning', () => (
      request.queries?.map((query) => query.trim()).filter(Boolean) ?? planSearchQueries(question)
    ));
    const errors: AgentErrorInfo[] = [];
    const maxSearchResults = request.maxSearchResults ?? this.config.maxSearchResults ?? DEFAULTS.maxSearchResults;
    const maxPagesToExtract = request.maxPagesToExtract ?? this.config.maxPagesToExtract ?? DEFAULTS.maxPagesToExtract;
    const maxEvidenceChunks = request.maxEvidenceChunks ?? this.config.maxEvidenceChunks ?? DEFAULTS.maxEvidenceChunks;
    const searchResults = await timeStageAsync(timings, 'searching', async () => this.searchMany({
      queries: plannedQueries,
      maxResults: maxSearchResults,
      request,
      errors,
    }));
    const extractedPages = await timeStageAsync(timings, 'extracting', async () => this.extractMany({
      results: searchResults.slice(0, maxPagesToExtract),
      request,
      errors,
    }));
    const retrievalMode = request.retrievalStrategy ?? (typeof this.config.retrievalStrategy === 'string' ? this.config.retrievalStrategy : 'text');
    const maxPointerBudget = request.maxPointerBudget ?? this.config.maxPointerBudget ?? DEFAULTS.maxPointerBudget;
    const { evidence, citations, pointerBundles } = timeStage(timings, 'ranking', () => {
      if (retrievalMode === 'ppgr') {
        const ppgr = runPpgrStrategy({
          question,
          pages: extractedPages,
          maxEvidenceChunks,
          maxPointerBudget,
        });
        return {
          evidence: ppgr.evidence,
          citations: ppgr.citations,
          pointerBundles: ppgr.pointerBundles,
        };
      }
      const strategy = resolveRetrievalStrategy(this.config.retrievalStrategy);
      const retrievalResult = strategy.retrieve({
        question,
        extractedPages,
        maxEvidenceChunks,
        metadata: request.metadata,
        mode: retrievalMode,
      });
      return { ...retrievalResult, pointerBundles: [] };
    });

    let answer: string | undefined;
    const shouldSynthesize = request.synthesize ?? false;
    if (shouldSynthesize && this.config.synthesizer && evidence.length > 0) {
      answer = await timeStageAsync(timings, 'synthesizing', async () => {
        try {
          return await this.config.synthesizer!.synthesize({
            question,
            evidence,
            citations,
            pointerBundles,
            model: request.model ?? this.config.defaultModel ?? DEFAULTS.defaultModel,
            signal: request.signal,
          });
        } catch (error) {
          errors.push(errorInfo('synthesizing', error, undefined, true));
          return undefined;
        }
      });
    }

    timings.complete = Date.now() - started;
    return {
      id: `research-${stableHash(JSON.stringify({ question, plannedQueries, metadata: request.metadata ?? {} }))}`,
      question,
      plannedQueries,
      searchResults,
      extractedPages,
      evidence,
      citations,
      ...(pointerBundles.length > 0 ? { pointerBundles } : {}),
      ...(answer ? { answer } : {}),
      errors,
      timings,
      elapsedMs: Date.now() - started,
      createdAt,
      ...(request.metadata ? { metadata: request.metadata } : {}),
    };
  }

  async search(query: string, options: Partial<WebResearchRunRequest> = {}): Promise<WebSearchResult[]> {
    const provider = this.searchProvider();
    return provider.search({
      query,
      maxResults: options.maxSearchResults ?? this.config.maxSearchResults ?? DEFAULTS.maxSearchResults,
      language: options.language,
      freshness: options.freshness,
      safeSearch: options.safeSearch,
      signal: options.signal,
    });
  }

  async extract(url: string, options: Partial<WebResearchRunRequest> = {}): Promise<ExtractedPage> {
    return this.extractor().extract({
      url,
      timeoutMs: this.config.extractionTimeoutMs ?? DEFAULTS.extractionTimeoutMs,
      signal: options.signal,
    });
  }

  async close(): Promise<void> {
    await this.config.extractor?.close?.();
  }

  private searchProvider() {
    return this.config.searchProvider ?? createSearchProviderFromConfig({
      ...this.config,
      searchTimeoutMs: this.config.searchTimeoutMs ?? DEFAULTS.searchTimeoutMs,
    });
  }

  private extractor() {
    return this.config.extractor ?? new FetchPageExtractor({
      allowPrivateUrlExtraction: this.config.allowPrivateUrlExtraction,
    });
  }

  private async searchMany(args: {
    queries: string[];
    maxResults: number;
    request: WebResearchRunRequest;
    errors: AgentErrorInfo[];
  }): Promise<WebSearchResult[]> {
    const provider = this.searchProvider();
    const results: WebSearchResult[] = [];
    for (const query of args.queries) {
      try {
        const cacheKey = `local-web-research:search:${stableHash(JSON.stringify({
          provider: provider.id,
          query,
          maxResults: args.maxResults,
          language: args.request.language,
          freshness: args.request.freshness,
          safeSearch: args.request.safeSearch,
        }))}`;
        const cached = await this.config.cache?.get<WebSearchResult[]>(cacheKey);
        const found = cached ?? await provider.search({
          query,
          maxResults: args.maxResults,
          language: args.request.language,
          freshness: args.request.freshness,
          safeSearch: args.request.safeSearch,
          signal: args.request.signal,
        });
        if (!cached) {
          await this.config.cache?.set(cacheKey, found, this.config.searchCacheTtlMs ?? DEFAULTS.searchCacheTtlMs);
        }
        results.push(...found);
      } catch (error) {
        args.errors.push(errorInfo('searching', error, undefined, true));
      }
    }
    return dedupeResults(results).slice(0, args.maxResults);
  }

  private async extractMany(args: {
    results: WebSearchResult[];
    request: WebResearchRunRequest;
    errors: AgentErrorInfo[];
  }): Promise<ExtractedPage[]> {
    const extractor = this.extractor();
    const pages = await mapWithConcurrency(args.results, 2, async (result) => {
      const cacheKey = `local-web-research:extract:${stableHash(result.normalizedUrl)}`;
      try {
        const cached = await this.config.cache?.get<ExtractedPage>(cacheKey);
        if (cached) return cached;
        const page = await extractor.extract({
          url: result.url,
          sourceResultId: result.id,
          timeoutMs: this.config.extractionTimeoutMs ?? DEFAULTS.extractionTimeoutMs,
          signal: args.request.signal,
        });
        await this.config.cache?.set(cacheKey, page, this.config.extractCacheTtlMs ?? DEFAULTS.extractCacheTtlMs);
        return page;
      } catch (error) {
        args.errors.push(errorInfo('extracting', error, result.url, true));
        return null;
      }
    });
    return pages.filter((page): page is ExtractedPage => Boolean(page));
  }
}

export async function runLocalWebResearchAgent(
  question: string,
  options: Partial<WebResearchRunRequest & WebResearchAgentConfig> = {},
): Promise<WebResearchRunResult> {
  const agent = new LocalWebResearchAgent(options);
  return agent.run({ ...options, question });
}

function dedupeResults(results: WebSearchResult[]): WebSearchResult[] {
  const seen = new Set<string>();
  const deduped: WebSearchResult[] = [];
  for (const result of results) {
    const normalized = normalizeUrl(result.normalizedUrl || result.url);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push({ ...result, normalizedUrl: normalized, rank: deduped.length + 1 });
  }
  return deduped;
}

function errorInfo(
  stage: AgentWorkflowStep,
  error: unknown,
  url: string | undefined,
  recoverable: boolean,
): AgentErrorInfo {
  return {
    stage,
    message: error instanceof Error ? error.message : String(error),
    ...(url ? { url } : {}),
    ...(error instanceof Error && error.cause ? { cause: String(error.cause) } : {}),
    recoverable,
  };
}

function timeStage<T>(
  timings: Partial<Record<AgentWorkflowStep, number>>,
  stage: AgentWorkflowStep,
  fn: () => T,
): T {
  const start = Date.now();
  try {
    return fn();
  } finally {
    timings[stage] = Date.now() - start;
  }
}

async function timeStageAsync<T>(
  timings: Partial<Record<AgentWorkflowStep, number>>,
  stage: AgentWorkflowStep,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    timings[stage] = Date.now() - start;
  }
}
