import { DEFAULT_RESEARCH_BUDGET } from './defaults';
import { decideNextStep, logDecision } from './decisions/decideNextStep';
import { shouldStop } from './decisions/shouldStop';
import { DeterministicGapAnalyzer } from './gaps/deterministicGapAnalyzer';
import { addTargetIfAllowed } from './frontier/addTargetIfAllowed';
import { selectNextTargets } from './frontier/selectNextTargets';
import { generateInitialTargets } from './queries/generateInitialTargets';
import { finalizeResult } from './state/finalizeResult';
import { initializeState } from './state/initializeState';
import { ingestTargetResult } from './state/ingestResults';
import type { CrawlTarget, ExtractedPageLike, RecursiveResearchAgentConfig, RecursiveResearchEvent, RecursiveResearchRequest, RecursiveResearchResult, ResearchState, SemanticSearchToolResult, WebResearchToolResult } from './types';
import { stableHash } from './utils/hash';
import { normalizeUrl } from './utils/normalizeUrl';
import { nowIso } from './utils/time';
import { mapWithConcurrency } from './utils/concurrency';

export class RecursiveResearchAgent {
  private readonly gapAnalyzer;
  private readonly defaults;

  constructor(private readonly config: RecursiveResearchAgentConfig) {
    this.defaults = { ...DEFAULT_RESEARCH_BUDGET, ...(config.defaults ?? {}) };
    this.gapAnalyzer = config.gapAnalyzer ?? new DeterministicGapAnalyzer();
  }

  async run(request: RecursiveResearchRequest): Promise<RecursiveResearchResult> {
    const state = initializeState(request, this.defaults);
    state.metadata = {
      ...(state.metadata ?? {}),
      enableSemanticExpansion: this.config.enableSemanticExpansion,
      enableLocalIndexSearch: Boolean(this.config.tools.localIndexSearchAgent),
    };
    await this.emit({ type: 'started', task: state.task });
    const initialTargets = generateInitialTargets({ request, task: state.task });
    for (const target of initialTargets) addTargetIfAllowed({ target, state });
    await this.emit({ type: 'frontier_seeded', targets: state.frontier.list() });

    while (!shouldStop(state).stop) {
      const targets = selectNextTargets(state, state.budget.maxTargetsPerIteration);
      if (targets.length === 0) break;
      await this.emit({ type: 'iteration_started', iteration: state.counters.iterations + 1, targets });
      await mapWithConcurrency(targets, 2, async (target) => this.executeAndIngest(state, target, request));
      state.counters.iterations += 1;
      await this.updateGaps(state, request.signal);
      const decision = decideNextStep(state);
      const logged = logDecision(state, decision);
      state.decisions.push(logged);
      await this.emit({ type: 'decision', decision: logged });
      if ('nextTargets' in decision) {
        for (const target of decision.nextTargets) addTargetIfAllowed({ target, state });
      }
      if (decision.action === 'stop') break;
    }

    const result = await finalizeResult({
      state,
      synthesizer: this.config.enableSynthesis === false ? undefined : this.config.tools.synthesizer,
      synthesize: request.synthesize,
      model: request.model,
      signal: request.signal,
    });
    await this.emit({ type: 'completed', result });
    return result;
  }

  private async executeAndIngest(state: ResearchState, target: CrawlTarget, request: RecursiveResearchRequest): Promise<void> {
    try {
      const result = await this.executeTarget(state, target, request);
      if (result) {
        ingestTargetResult({ state, target, result });
        await this.emit({ type: 'target_completed', target, evidenceCount: state.evidence.filter((item) => item.discoveredByTargetId === target.id).length });
      } else {
        this.markVisited(state, target, 'skipped', 'No compatible tool is available for this target.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.markVisited(state, target, 'failed', message);
      state.errors.push({ stage: 'executing_target', message, targetId: target.id, ...('url' in target ? { url: target.url } : {}), recoverable: true });
      await this.emit({ type: 'target_failed', target, error: message });
    }
  }

  private async executeTarget(state: ResearchState, target: CrawlTarget, request: RecursiveResearchRequest): Promise<WebResearchToolResult | SemanticSearchToolResult | ExtractedPageLike | undefined> {
    const metadata = { recursiveRunId: state.id, targetId: target.id, depth: target.depth, ...(request.metadata ?? {}) };
    switch (target.kind) {
      case 'search_query':
        state.counters.searchQueriesExecuted += 1;
        return this.config.tools.webResearchAgent.run({
          question: target.query,
          maxSearchResults: remainingSearchBudget(state),
          maxPagesToExtract: pagesForTarget(state),
          maxEvidenceChunks: 8,
          synthesize: false,
          signal: request.signal,
          metadata,
        });
      case 'domain_search':
        state.counters.searchQueriesExecuted += 1;
        return this.config.tools.webResearchAgent.run({
          question: `site:${target.domain} ${target.query}`,
          maxSearchResults: remainingSearchBudget(state),
          maxPagesToExtract: pagesForTarget(state),
          maxEvidenceChunks: 8,
          synthesize: false,
          signal: request.signal,
          metadata,
        });
      case 'semantic_query':
        if (!this.config.tools.semanticSearchAgent) return undefined;
        state.counters.searchQueriesExecuted += 1;
        return this.config.tools.semanticSearchAgent.run({ question: target.query, maxResults: 8, signal: request.signal, metadata });
      case 'local_index_query':
        if (!this.config.tools.localIndexSearchAgent) return undefined;
        state.counters.searchQueriesExecuted += 1;
        return this.config.tools.localIndexSearchAgent.run({ question: target.query, maxResults: 8, signal: request.signal, metadata });
      case 'entity_expand':
        state.counters.searchQueriesExecuted += 1;
        if (this.config.tools.semanticSearchAgent) return this.config.tools.semanticSearchAgent.run({ question: target.entity, maxResults: 8, signal: request.signal, metadata });
        return this.config.tools.webResearchAgent.run({ question: target.entity, maxSearchResults: remainingSearchBudget(state), maxPagesToExtract: pagesForTarget(state), maxEvidenceChunks: 8, synthesize: false, signal: request.signal, metadata });
      case 'url':
        state.counters.urlsFetched += 1;
        if (this.config.tools.extractor) return this.config.tools.extractor.extract({ url: target.url, signal: request.signal, metadata });
        return this.config.tools.webResearchAgent.extract?.(target.url, { signal: request.signal });
    }
  }

  private async updateGaps(state: ResearchState, signal?: AbortSignal): Promise<void> {
    try {
      const analysis = await this.gapAnalyzer.analyze({
        task: state.task,
        evidence: state.evidence,
        claims: state.claims,
        previousGaps: state.gaps,
        budgetRemaining: remainingBudget(state),
        signal,
      });
      state.gaps = analysis.gaps;
      if (analysis.claims) state.claims = analysis.claims;
      for (const gap of state.gaps) {
        state.graph.addNode({ id: gap.id, type: 'gap', value: gap.description, metadata: { priority: gap.priority, status: gap.status } });
        state.graph.addEdge({ from: state.task.id, to: gap.id, type: 'created_gap' });
      }
      await this.emit({ type: 'gaps_updated', gaps: state.gaps });
    } catch (error) {
      state.errors.push({ stage: 'gap_analysis', message: error instanceof Error ? error.message : String(error), recoverable: true });
    }
  }

  private markVisited(state: ResearchState, target: CrawlTarget, status: 'failed' | 'skipped', reason: string): void {
    state.visited.push({
      id: `visited-${stableHash(`${target.id}:${status}:${reason}`)}`,
      targetId: target.id,
      kind: target.kind,
      ...('url' in target ? { url: target.url, normalizedUrl: normalizeUrl(target.url) } : {}),
      ...('query' in target ? { query: target.query } : {}),
      depth: target.depth,
      status,
      reason,
      visitedAt: nowIso(),
    });
  }

  private async emit(event: RecursiveResearchEvent): Promise<void> {
    await this.config.onEvent?.(event);
  }
}

function remainingSearchBudget(state: ResearchState): number {
  return Math.max(0, state.budget.maxSearchQueries - state.counters.searchQueriesExecuted);
}

function pagesForTarget(state: ResearchState): number {
  return Math.max(0, Math.min(3, state.budget.maxFetchedPages - state.counters.urlsFetched));
}

function remainingBudget(state: ResearchState) {
  return {
    maxIterations: Math.max(0, state.budget.maxIterations - state.counters.iterations),
    maxSearchQueries: Math.max(0, state.budget.maxSearchQueries - state.counters.searchQueriesExecuted),
    maxFetchedPages: Math.max(0, state.budget.maxFetchedPages - state.counters.urlsFetched),
  };
}
