import { describe, expect, it, vi } from 'vitest';
import { RecursiveResearchAgent } from '../agent';
import { asWebResearchTool } from '../adapters/webResearchAdapter';
import { decideNextStep } from '../decisions/decideNextStep';
import { shouldStop } from '../decisions/shouldStop';
import { addTargetIfAllowed, visitedUrl } from '../frontier/addTargetIfAllowed';
import { equivalentKey, FrontierQueue } from '../frontier/FrontierQueue';
import { scoreTarget } from '../frontier/scoreTarget';
import { DeterministicGapAnalyzer } from '../gaps/deterministicGapAnalyzer';
import { LlmGapAnalyzer } from '../gaps/llmGapAnalyzer';
import { MutableResearchGraph } from '../graph/ResearchGraph';
import { extractCandidateLinks } from '../links/extractCandidateLinks';
import { scoreCandidateLink } from '../links/scoreCandidateLink';
import { generateFollowUpTargets } from '../queries/generateFollowUpTargets';
import { generateInitialTargets } from '../queries/generateInitialTargets';
import { finalizeResult } from '../state/finalizeResult';
import { initializeState } from '../state/initializeState';
import { domainForEvidence, ingestTargetResult } from '../state/ingestResults';
import type { CrawlTarget, ExtractedPageLike, ResearchState, WebResearchTool } from '../types';
import { clamp } from '../utils/clamp';
import { mapWithConcurrency } from '../utils/concurrency';
import { domainFromUrl, isLikelyAuthorityUrl, isSameDomain } from '../utils/domain';
import { normalizeUrl } from '../utils/normalizeUrl';
import { makeEvidence, makeState, makeTarget, makeTask } from './helpers';

describe('coverage edge cases', () => {
  it('covers utility normalization, domains, graph de-duplication, and concurrency ordering', async () => {
    expect(clamp(Number.NaN, 0.2)).toBe(0.2);
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1)).toBe(0);
    expect(normalizeUrl(' HTTPS://Example.COM/docs/?b=2&utm_source=x&a=1#top ')).toBe('https://example.com/docs?a=1&b=2');
    expect(normalizeUrl('not a url')).toBe('not a url');
    expect(domainFromUrl('not a url')).toBeUndefined();
    expect(isSameDomain('https://docs.example.com/a', 'example.com')).toBe(true);
    expect(isSameDomain('example.com', 'docs.example.com')).toBe(true);
    expect(isLikelyAuthorityUrl('https://example.gov/reference')).toBe(true);
    expect(isLikelyAuthorityUrl('https://plain.example.com/about')).toBe(false);
    expect(isLikelyAuthorityUrl('not a url with /docs')).toBe(true);

    const graph = new MutableResearchGraph();
    graph.addNode({ id: 'a', type: 'task', value: 'Task' });
    graph.addNode({ id: 'a', type: 'task', value: 'Duplicate ignored' });
    graph.addEdge({ from: 'a', to: 'b', type: 'spawned' });
    graph.addEdge({ from: 'a', to: 'b', type: 'spawned' });
    expect(graph.toJSON().nodes).toHaveLength(1);
    expect(graph.toJSON().edges).toHaveLength(1);

    await expect(mapWithConcurrency([], 0, async (item: number) => item)).resolves.toEqual([]);
    await expect(mapWithConcurrency([3, 1, 2], 1.2, async (item) => item * 2)).resolves.toEqual([6, 2, 4]);
  });

  it('covers frontier, target scoring, scope, and initial target edge cases', () => {
    const queue = new FrontierQueue({ maxSize: 1 });
    expect(queue.add(makeTarget({ priority: 0 }))).toBe(false);
    expect(queue.nextBatch(-1)).toEqual([]);
    expect(queue.add(makeTarget({ id: 'later', query: 'tie two', priority: 0.5, createdAt: '2026-04-30T01:00:00.000Z' }))).toBe(true);
    expect(queue.add(makeTarget({ id: 'earlier', query: 'tie one', priority: 0.5, createdAt: '2026-04-30T00:00:00.000Z' }))).toBe(true);
    expect(queue.list()[0]?.id).toBe('earlier');
    expect(queue.addMany([makeTarget({ id: 'zero', query: 'zero', priority: 0 }), makeTarget({ id: 'earlier-dupe', query: 'tie one' })])).toBe(0);
    expect(equivalentKey(makeTarget({ kind: 'domain_search', domain: 'Example.COM', query: ' Foo  Bar ' }))).toBe('domain:example.com:foo bar');
    expect(equivalentKey(makeTarget({ kind: 'entity_expand', entity: 'Entity Name' }))).toBe('entity:entity name');

    const scoped = makeState({
      task: makeTask({ scope: { domains: ['allowed.example.com'], excludedDomains: ['blocked.example.com'] } }),
      visited: [
        { id: 'vq', targetId: 'old-query', kind: 'search_query', query: 'seen query', depth: 0, status: 'success', visitedAt: new Date(0).toISOString() },
        { id: 'vu', targetId: 'old-url', kind: 'url', url: 'https://allowed.example.com/a', normalizedUrl: 'https://allowed.example.com/a', depth: 0, status: 'success', visitedAt: new Date(0).toISOString() },
      ],
    });
    scoped.frontier.add(makeTarget({ id: 'already-frontier', query: 'already' }));
    expect(addTargetIfAllowed({ target: makeTarget({ id: 'seen-query', query: 'seen query' }), state: scoped })).toBe(false);
    expect(addTargetIfAllowed({ target: makeTarget({ id: 'dupe-frontier', query: 'already' }), state: scoped })).toBe(false);
    expect(addTargetIfAllowed({ target: makeTarget({ id: 'blocked', kind: 'url', url: 'https://blocked.example.com/a' }), state: scoped })).toBe(false);
    expect(addTargetIfAllowed({ target: makeTarget({ id: 'outside', kind: 'domain_search', domain: 'outside.example.com', query: 'x' }), state: scoped })).toBe(false);
    expect(visitedUrl('https://Example.com/a?utm_source=x#y')).toBe('https://example.com/a');
    expect(addTargetIfAllowed({
      target: makeTarget({ id: 'fetch-budget', kind: 'url', url: 'https://allowed.example.com/fetch-budget' }),
      state: makeState({ counters: { iterations: 0, searchQueriesExecuted: 0, urlsFetched: 12 } }),
    })).toBe(false);
    expect(addTargetIfAllowed({
      target: makeTarget({ id: 'unkeyed-visited', query: 'new query' }),
      state: makeState({ visited: [{ id: 'v-empty', targetId: 'empty', kind: 'entity_expand', depth: 0, status: 'success', visitedAt: new Date(0).toISOString() }] }),
    })).toBe(true);
    expect(addTargetIfAllowed({
      target: makeTarget({ id: 'invalid-domain', kind: 'url', url: 'not a url' }),
      state: makeState(),
    })).toBe(true);

    const saturated = makeState({
      budget: { ...makeState().budget, maxPagesPerDomain: 1 },
      visited: [{ id: 'v1', targetId: 't1', kind: 'url', url: 'https://full.example.com/a', normalizedUrl: 'https://full.example.com/a', depth: 0, status: 'success', visitedAt: new Date(0).toISOString() }],
    });
    expect(addTargetIfAllowed({ target: makeTarget({ kind: 'url', url: 'https://full.example.com/b' }), state: saturated })).toBe(false);

    const outOfScope = scoreTarget({ target: makeTarget({ kind: 'url', url: 'https://blocked.example.com/docs' }), state: scoped });
    const allowedScopeScore = scoreTarget({ target: { id: 'allowed-url', kind: 'url', url: 'https://allowed.example.com/docs', priority: 0.5, depth: 0, reason: 'allowed', createdAt: new Date(0).toISOString() }, state: scoped });
    const duplicate = scoreTarget({ target: makeTarget({ query: 'already', depth: 3 }), state: scoped });
    const entityOnlyTarget: CrawlTarget = { id: 'entity-only', kind: 'entity_expand', entity: 'local indexing', priority: 0.5, depth: 0, reason: 'entity', createdAt: new Date(0).toISOString() };
    const urlOnlyTarget: CrawlTarget = { id: 'url-only', kind: 'url', url: 'not a url', priority: 0.5, depth: 0, reason: 'url', createdAt: new Date(0).toISOString() };
    const entityScore = scoreTarget({ target: entityOnlyTarget, state: makeState() });
    const invalidUrlScore = scoreTarget({ target: urlOnlyTarget, state: makeState() });
    expect(outOfScope).toBe(0);
    expect(allowedScopeScore).toBeGreaterThan(0);
    expect(duplicate).toBeLessThan(0.7);
    expect(entityScore).toBeGreaterThan(0);
    expect(invalidUrlScore).toBeGreaterThan(0);

    const currentTargets = generateInitialTargets({
      request: { question: 'latest current search tools', initialQueries: ['custom query', 'custom query'], initialUrls: ['https://example.com/start'] },
      task: makeTask({ question: 'latest current search tools' }),
    });
    expect(currentTargets.some((target) => target.kind === 'url')).toBe(true);
    expect(currentTargets.some((target) => 'query' in target && target.query.includes(String(new Date().getFullYear())))).toBe(true);

    const fillerTargets = generateInitialTargets({ request: { question: 'what are the best' }, task: makeTask({ question: 'what are the best' }) });
    expect(fillerTargets).toHaveLength(1);
  });

  it('covers state initialization, ingestion shapes, finalization, and gap analyzers', async () => {
    expect(() => initializeState({ question: '   ' })).toThrow(/non-empty/);
    const state = initializeState({
      question: '  Compare tools  ',
      objective: 'find_sources',
      scope: { freshness: 'year' },
      successCriteria: [],
      metadata: { source: 'test' },
    });
    expect(state.task.question).toBe('Compare tools');
    expect(state.task.objective).toBe('find_sources');
    expect(state.task.successCriteria.length).toBeGreaterThan(0);
    expect(state.metadata).toEqual({ source: 'test' });

    const target = makeTarget({ kind: 'url', url: 'https://docs.example.com/page' });
    ingestTargetResult({ state, target, result: { url: 'https://docs.example.com/page', finalUrl: 'https://docs.example.com/page#final', title: 'Docs', text: 'Compare tools with 2026 current docs.' } });
    ingestTargetResult({ state, target, result: { results: [{ title: 'Semantic', url: 'https://semantic.example.com/entity', description: 'semantic evidence', score: 0.7 }] } });
    ingestTargetResult({ state, target: { id: 'entity-target', kind: 'entity_expand', entity: 'Semantic entity', priority: 0.5, depth: 1, reason: 'entity', createdAt: new Date(0).toISOString() }, result: { results: [{ title: 'Semantic title fallback', url: 'https://semantic.example.com/fallback' }] } });
    ingestTargetResult({ state, target, result: { url: 'https://authority.example.com/docs', title: 'Authority', text: 'Authority docs mention compare tools.' } });
    ingestTargetResult({
      state,
      target,
      result: {
        extractedPages: [{ url: 'https://page.example.com', title: 'Page', text: 'page evidence' }],
        searchResults: [{ title: 'Snippet', url: 'https://snippet.example.com', snippet: 'snippet evidence' }],
      },
    });
    ingestTargetResult({
      state,
      target,
      result: {
        evidence: [{ url: 'https://dupe.example.com', title: 'Dupe', text: 'same text', citationId: 7 }],
        searchResults: [{ title: 'Dupe snippet ignored', url: 'https://dupe.example.com', snippet: 'same url snippet' }],
        citations: [{ id: 7, title: 'Dupe', url: 'https://dupe.example.com' }],
      },
    });
    ingestTargetResult({
      state,
      target,
      result: {
        evidence: [{ url: 'https://dupe.example.com/again', text: 'same text' }],
        citations: [{ id: 8, title: 'Existing URL', url: 'https://dupe.example.com' }],
      },
    });
    ingestTargetResult({ state, target, result: { evidence: [{ url: 'https://exact.example.com', text: 'exact duplicate' }] } });
    ingestTargetResult({ state, target, result: { evidence: [{ url: 'https://exact.example.com', text: 'exact duplicate' }] } });
    ingestTargetResult({ state, target, result: { citations: [{ id: 99, title: 'Citation only', url: 'https://citation-only.example.com' }] } });
    ingestTargetResult({
      state,
      target,
      result: {
        searchResults: [{ title: 'Title fallback text', url: 'https://title.example.com', normalizedUrl: 'https://title.example.com/' }],
      },
    });
    ingestTargetResult({
      state,
      target,
      result: { url: 'https://symbols.example.com', title: 'Symbols', text: '!!!' },
    });
    expect(state.evidence.some((item) => item.sourceType === 'semantic_result')).toBe(true);
    expect(domainForEvidence(state.evidence[0]!)).toBeDefined();

    const finalized = await finalizeResult({
      state,
      synthesize: true,
      model: 'local',
      synthesizer: { synthesize: vi.fn(async ({ model }) => `answer from ${model}`) },
    });
    expect(finalized.finalAnswer).toBe('answer from local');
    expect(finalized.metrics.uniqueDomainsVisited).toBeGreaterThan(0);
    const synthesisStringFailure = await finalizeResult({
      state,
      synthesize: true,
      synthesizer: { synthesize: vi.fn(async () => { throw 'string synthesis failure'; }) },
    });
    expect(synthesisStringFailure.errors.some((error) => error.message === 'string synthesis failure')).toBe(true);

    const llm = new LlmGapAnalyzer({
      callModel: vi.fn(async () => JSON.stringify({
        gaps: [{
          description: 'Need docs',
          priority: 2,
          suggestedQueries: ['one', 2, 'two', 'three', 'four'],
          suggestedDomains: ['docs.example.com', 9],
          suggestedUrls: ['https://docs.example.com', false],
          reason: 'missing',
        }],
        claims: [{ text: 'Claim', confidence: -1, supportingEvidenceIds: ['e1', 4], contradictingEvidenceIds: ['e2'], status: 'weird' }],
      })),
    });
    const llmResult = await llm.analyze({
      task: state.task,
      evidence: state.evidence,
      claims: [],
      previousGaps: [{ id: 'gap-old', description: 'old gap', priority: 0.3, suggestedQueries: [], reason: 'old', status: 'open' }],
      budgetRemaining: {},
    });
    expect(llmResult.gaps[0]?.priority).toBe(1);
    expect(llmResult.gaps[0]?.suggestedQueries).toEqual(['one', 'two', 'three']);
    expect(llmResult.claims?.[0]?.status).toBe('uncertain');
    const noClaimsLlm = new LlmGapAnalyzer({ callModel: vi.fn(async () => JSON.stringify({ gaps: [] })) });
    expect(await noClaimsLlm.analyze({ task: state.task, evidence: [], claims: [], previousGaps: [], budgetRemaining: {} })).toEqual({ gaps: [] });
    const sparseLlm = new LlmGapAnalyzer({
      callModel: vi.fn(async () => JSON.stringify({
        gaps: [null, { description: 'Sparse gap', reason: 'sparse' }],
        claims: [null, { text: 'Supported claim', status: 'supported', confidence: 2 }, { text: 'Contradicted claim', status: 'contradicted' }],
      })),
    });
    const sparseResult = await sparseLlm.analyze({ task: state.task, evidence: [], claims: [], previousGaps: [], budgetRemaining: {} });
    expect(sparseResult.gaps[0]?.priority).toBe(0.5);
    expect(sparseResult.claims?.map((claim) => claim.status)).toEqual(['supported', 'contradicted']);

    const fallback = new LlmGapAnalyzer({ callModel: vi.fn(async () => '{"gaps":"bad"}') });
    expect((await fallback.analyze({ task: makeTask({ successCriteria: ['missing'] }), evidence: [], claims: [], previousGaps: [], budgetRemaining: {} })).gaps.length).toBeGreaterThan(0);
    const thrown = new LlmGapAnalyzer({ callModel: vi.fn(async () => { throw new Error('bad json'); }) });
    expect((await thrown.analyze({ task: makeTask({ successCriteria: ['missing'] }), evidence: [], claims: [], previousGaps: [], budgetRemaining: {} })).gaps.length).toBeGreaterThan(0);

    const analyzer = new DeterministicGapAnalyzer();
    const punctuationCriterion = await analyzer.analyze({
      task: makeTask({ successCriteria: ['!!!'], scope: { freshness: 'year' } }),
      evidence: [makeEvidence({ text: `Current evidence ${new Date().getFullYear()}.` })],
      claims: [],
      previousGaps: [],
      budgetRemaining: {},
    });
    expect(punctuationCriterion.gaps.some((gap) => gap.description.includes('!!!'))).toBe(false);
    const noHighPriorityGaps = await analyzer.analyze({
      task: makeTask({ successCriteria: ['metasearch'] }),
      evidence: [
        makeEvidence({ text: 'metasearch one', url: 'https://a.example.com', quality: { relevance: 0.9, authority: 0.9, freshness: 1, informationGain: 0.9, overall: 0.8 } }),
        makeEvidence({ id: 'e2', text: 'metasearch two', url: 'https://b.example.com', quality: { relevance: 0.9, authority: 0.9, freshness: 1, informationGain: 0.9, overall: 0.8 } }),
        makeEvidence({ id: 'e3', text: 'metasearch three', url: 'https://c.example.com', quality: { relevance: 0.9, authority: 0.9, freshness: 1, informationGain: 0.9, overall: 0.8 } }),
      ],
      claims: [],
      previousGaps: [],
      budgetRemaining: {},
    });
    expect(noHighPriorityGaps.gaps.filter((gap) => gap.priority >= 0.6)).toHaveLength(0);
  });

  it('covers link extraction, candidate scoring, follow-up target variants, and decisions', () => {
    const links = extractCandidateLinks({
      pageUrl: 'https://example.com/base/page',
      html: '<a href="/docs">Docs</a><a href="https://github.com/org/repo">Repo</a>',
    });
    expect(links.map((link) => link.normalizedUrl)).toEqual(['https://example.com/docs', 'https://github.com/org/repo']);
    expect(extractCandidateLinks({ pageUrl: 'https://example.com', text: 'plain text' })).toEqual([]);
    expect(extractCandidateLinks({ pageUrl: 'https://example.com' })).toEqual([]);

    const state = makeState();
    const low = scoreCandidateLink({
      link: { url: 'https://example.com/about', normalizedUrl: 'https://example.com/about', sourcePageUrl: 'https://example.com', score: 0, reason: '' },
      task: makeTask({ question: 'zzzzzz', successCriteria: ['yyyyyy'] }),
      state,
    });
    const bad = scoreCandidateLink({
      link: { url: 'https://example.com/tag/search', normalizedUrl: 'https://example.com/tag/search', sourcePageUrl: 'https://example.com', anchorText: 'archive', score: 0, reason: '' },
      task: makeTask(),
      state,
    });
    const questionMatch = scoreCandidateLink({
      link: { url: 'https://example.com/free', normalizedUrl: 'https://example.com/free', sourcePageUrl: 'https://example.com', anchorText: 'free tier', surroundingText: 'agent comparison', score: 0, reason: '' },
      task: makeTask({ question: 'agent crawler', successCriteria: ['unmatched'] }),
      state,
    });
    const allowedScope = scoreCandidateLink({
      link: { url: 'https://docs.example.com/guide', normalizedUrl: 'https://docs.example.com/guide', sourcePageUrl: 'https://docs.example.com', anchorText: 'guide', score: 0, reason: '' },
      task: makeTask({ scope: { domains: ['docs.example.com'] }, question: 'ai', successCriteria: ['guide'] }),
      state,
    });
    expect(low.reason).toBe('Low task match.');
    expect(bad.score).toBe(0);
    expect(questionMatch.score).toBeGreaterThanOrEqual(0.55);
    expect(allowedScope.score).toBeGreaterThan(0);

    const followState = makeState({ metadata: { enableSemanticExpansion: true, enableLocalIndexSearch: true } });
    const targets = generateFollowUpTargets({
      state: followState,
      gaps: [{ id: 'gap-1', description: 'Need more', priority: 0.8, suggestedQueries: ['docs query'], reason: 'missing', status: 'open' }],
    });
    expect(targets.map((target) => target.kind)).toEqual(expect.arrayContaining(['search_query', 'semantic_query', 'local_index_query']));
    const domainFallback = generateFollowUpTargets({
      state: makeState(),
      gaps: [{ id: 'gap-domain-fallback', description: 'Domain fallback', priority: 0.8, suggestedQueries: [], suggestedDomains: ['docs.example.com'], reason: 'domain', status: 'open' }],
    });
    expect(domainFallback[0]).toEqual(expect.objectContaining({ kind: 'domain_search', query: makeState().task.question }));
    followState.frontier.add(makeTarget({ query: 'duplicate query' }));
    const deduped = generateFollowUpTargets({
      state: followState,
      gaps: [{ id: 'gap-dup', description: 'Duplicates', priority: 0.8, suggestedQueries: ['duplicate query', 'duplicate query'], suggestedUrls: ['https://dup.example.com', 'https://dup.example.com'], reason: 'dedupe', status: 'open' }],
    });
    expect(deduped.filter((target) => target.kind === 'search_query' && target.query === 'duplicate query')).toHaveLength(0);
    expect(deduped.filter((target) => target.kind === 'url' && target.url === 'https://dup.example.com')).toHaveLength(1);

    const fetchState = makeState();
    fetchState.frontier.add(makeTarget({ kind: 'url', url: 'https://docs.example.com', priority: 0.8 }));
    expect(decideNextStep(fetchState).action).toBe('fetch_more_from_existing_results');

    const changeState = makeState({ metadata: { redundantIterations: 2, enableLocalIndexSearch: true, enableSemanticExpansion: true } });
    expect(decideNextStep(changeState).action).toBe('change_strategy');
    expect(decideNextStep(makeState({ metadata: { redundantIterations: 2, enableLocalIndexSearch: true } })).action).toBe('change_strategy');
    expect(decideNextStep(makeState({ metadata: { redundantIterations: 2, enableSemanticExpansion: true } })).action).toBe('change_strategy');
    expect(decideNextStep(makeState({ metadata: { redundantIterations: 2 } })).action).toBe('stop');
    const noUsefulTarget = makeState();
    noUsefulTarget.frontier.add(makeTarget({ kind: 'semantic_query', query: 'semantic only', priority: 0.8 }));
    expect(decideNextStep(noUsefulTarget).reason).toContain('No useful');

    const aborted = makeState({ metadata: { aborted: true } });
    aborted.frontier.add(makeTarget());
    expect(shouldStop(aborted).reason).toContain('AbortSignal');
    const noPriority = makeState();
    noPriority.frontier.add(makeTarget({ priority: 0.1 }));
    expect(shouldStop(noPriority).reason).toContain('No high-priority');
    const redundant = makeState({ metadata: { redundantIterations: 2 } });
    redundant.frontier.add(makeTarget());
    expect(shouldStop(redundant).reason).toContain('redundant');
  });

  it('covers agent target execution for optional tools, skips, gap errors, and disabled synthesis', async () => {
    const baseRun = vi.fn(async ({ question }) => ({
      evidence: [{ url: `https://web.example.com/${encodeURIComponent(question)}`, text: `web evidence ${question}` }],
    }));
    const webResearchAgent = asWebResearchTool({ run: baseRun });

    const semanticAgent = { run: vi.fn(async () => ({ results: [{ title: 'Semantic', url: 'https://semantic.example.com', description: 'semantic result' }] })) };
    const localIndexSearchAgent = { run: vi.fn(async () => ({ evidence: [{ url: 'https://local.example.com', text: 'local result' }] })) };
    const gapAnalyzer = {
      analyze: vi.fn(async () => ({
        gaps: [{ id: 'gap-tools', description: 'Need tools', priority: 0.9, suggestedQueries: ['tools query'], reason: 'missing', status: 'open' as const }],
      })),
    };
    const agent = new RecursiveResearchAgent({
      tools: { webResearchAgent, semanticSearchAgent: semanticAgent, localIndexSearchAgent },
      gapAnalyzer,
      enableSemanticExpansion: true,
      defaults: { maxIterations: 2, maxTargetsPerIteration: 4, targetSufficiencyScore: 0.99 },
    });
    const result = await agent.run({ question: 'tools' });
    expect(semanticAgent.run).toHaveBeenCalled();
    expect(localIndexSearchAgent.run).toHaveBeenCalled();
    expect(result.visited.some((visit) => visit.kind === 'semantic_query')).toBe(true);

    const extractor = { extract: vi.fn(async ({ url }): Promise<ExtractedPageLike> => ({ url, text: 'extracted page' })) };
    const urlAgent = new RecursiveResearchAgent({ tools: { webResearchAgent, extractor }, defaults: { maxIterations: 1, targetSufficiencyScore: 0.99 } });
    expect((await urlAgent.run({ question: 'url run', initialUrls: ['https://docs.example.com/page'] })).metrics.urlsFetched).toBe(1);
    expect(extractor.extract).toHaveBeenCalled();

    const extractFallback = vi.fn(async (url: string) => ({ url, text: 'fallback extracted' }));
    const fallbackAgent = new RecursiveResearchAgent({
      tools: { webResearchAgent: { run: baseRun, extract: extractFallback } },
      defaults: { maxIterations: 1, maxTargetsPerIteration: 2, targetSufficiencyScore: 0.99 },
    });
    await fallbackAgent.run({ question: 'fallback url', initialUrls: ['https://docs.example.com/fallback'] });
    expect(extractFallback).toHaveBeenCalled();

    const skippedAgent = new RecursiveResearchAgent({
      tools: { webResearchAgent },
      enableSemanticExpansion: true,
      gapAnalyzer,
      defaults: { maxIterations: 2, maxTargetsPerIteration: 3, targetSufficiencyScore: 0.99 },
    });
    const skipped = await skippedAgent.run({ question: 'skip semantic' });
    expect(skipped.visited.some((visit) => visit.status === 'skipped')).toBe(true);

    const failingGaps = new RecursiveResearchAgent({
      tools: { webResearchAgent },
      gapAnalyzer: { analyze: vi.fn(async () => { throw 'gap string failure'; }) },
      defaults: { maxIterations: 1, targetSufficiencyScore: 0.99 },
    });
    const gapFailure = await failingGaps.run({ question: 'gap failure' });
    expect(gapFailure.errors.some((error) => error.stage === 'gap_analysis' && error.message === 'gap string failure')).toBe(true);

    const synthesizer = { synthesize: vi.fn(async () => 'should not run') };
    const noSynthesis = new RecursiveResearchAgent({
      tools: { webResearchAgent, synthesizer },
      enableSynthesis: false,
      defaults: { maxIterations: 1, targetSufficiencyScore: 0.99 },
    });
    expect((await noSynthesis.run({ question: 'no synth', synthesize: true })).finalAnswer).toBeUndefined();
    expect(synthesizer.synthesize).not.toHaveBeenCalled();

    const noBatch = new RecursiveResearchAgent({
      tools: { webResearchAgent },
      defaults: { maxIterations: 1, maxTargetsPerIteration: 0, targetSufficiencyScore: 0.99 },
    });
    expect((await noBatch.run({ question: 'no batch' })).metrics.iterations).toBe(0);

    const stringFailure = new RecursiveResearchAgent({
      tools: { webResearchAgent: { run: vi.fn(async () => { throw 'string target failure'; }) } },
      defaults: { maxIterations: 1, targetSufficiencyScore: 0.99 },
    });
    const stringFailureResult = await stringFailure.run({ question: 'string failure' });
    expect(stringFailureResult.errors.some((error) => error.message === 'string target failure')).toBe(true);

    const urlFailure = new RecursiveResearchAgent({
      tools: { webResearchAgent, extractor: { extract: vi.fn(async () => { throw new Error('extract failed'); }) } },
      defaults: { maxIterations: 1, maxTargetsPerIteration: 2, targetSufficiencyScore: 0.99 },
    });
    const urlFailureResult = await urlFailure.run({ question: 'url failure', initialUrls: ['https://fail.example.com'] });
    expect(urlFailureResult.errors.some((error) => error.url === 'https://fail.example.com')).toBe(true);

    const claimAgent = new RecursiveResearchAgent({
      tools: { webResearchAgent },
      gapAnalyzer: { analyze: vi.fn(async () => ({ gaps: [], claims: [{ id: 'claim', text: 'claim', confidence: 1, supportingEvidenceIds: [], contradictingEvidenceIds: [], status: 'supported' as const }] })) },
      defaults: { maxIterations: 1, targetSufficiencyScore: 0.99 },
    });
    expect((await claimAgent.run({ question: 'claims' })).claims).toHaveLength(1);

    const gapError = new RecursiveResearchAgent({
      tools: { webResearchAgent },
      gapAnalyzer: { analyze: vi.fn(async () => { throw new Error('gap error'); }) },
      defaults: { maxIterations: 1, targetSufficiencyScore: 0.99 },
    });
    expect((await gapError.run({ question: 'gap error' })).errors.some((error) => error.message === 'gap error')).toBe(true);
  });

  it('covers private target variants without exposing them publicly', async () => {
    const webResearchAgent: WebResearchTool = {
      run: vi.fn(async ({ question }) => ({ evidence: [{ url: `https://web.example.com/${question}`, text: question }] })),
      extract: vi.fn(async (url) => ({ url, text: 'extract fallback' })),
    };
    const semanticSearchAgent = { run: vi.fn(async ({ question }) => ({ results: [{ title: question, url: `https://semantic.example.com/${question}` }] })) };
    const localIndexSearchAgent = { run: vi.fn(async ({ question }) => ({ evidence: [{ url: `https://local.example.com/${question}`, text: question }] })) };
    const extractor = { extract: vi.fn(async ({ url }) => ({ url, text: 'extractor' })) };
    const agent = new RecursiveResearchAgent({ tools: { webResearchAgent, semanticSearchAgent, localIndexSearchAgent, extractor } });
    const executable = agent as unknown as {
      executeTarget: (state: ResearchState, target: CrawlTarget, request: { question: string }) => Promise<unknown>;
    };
    const state = makeState({ budget: { ...makeState().budget, maxFetchedPages: 1, maxSearchQueries: 1 } });

    await executable.executeTarget(state, makeTarget({ kind: 'domain_search', domain: 'example.com', query: 'docs' }), { question: 'q' });
    await executable.executeTarget(state, makeTarget({ kind: 'semantic_query', query: 'entity' }), { question: 'q' });
    await executable.executeTarget(state, makeTarget({ kind: 'local_index_query', query: 'local' }), { question: 'q' });
    await executable.executeTarget(state, makeTarget({ kind: 'entity_expand', entity: 'Q42' }), { question: 'q' });
    await executable.executeTarget(state, makeTarget({ kind: 'url', url: 'https://docs.example.com' }), { question: 'q' });
    expect(webResearchAgent.run).toHaveBeenCalledWith(expect.objectContaining({ question: 'site:example.com docs' }));
    expect(semanticSearchAgent.run).toHaveBeenCalledTimes(2);
    expect(localIndexSearchAgent.run).toHaveBeenCalled();
    expect(extractor.extract).toHaveBeenCalled();

    const noOptional = new RecursiveResearchAgent({ tools: { webResearchAgent } });
    const noOptionalExecutable = noOptional as unknown as typeof executable;
    await expect(noOptionalExecutable.executeTarget(makeState(), makeTarget({ kind: 'semantic_query', query: 'missing' }), { question: 'q' })).resolves.toBeUndefined();
    await expect(noOptionalExecutable.executeTarget(makeState(), makeTarget({ kind: 'local_index_query', query: 'missing' }), { question: 'q' })).resolves.toBeUndefined();
    await noOptionalExecutable.executeTarget(makeState(), makeTarget({ kind: 'entity_expand', entity: 'fallback entity' }), { question: 'q' });
    const noExtractor = new RecursiveResearchAgent({ tools: { webResearchAgent: { run: webResearchAgent.run } } });
    await expect((noExtractor as unknown as typeof executable).executeTarget(makeState(), makeTarget({ kind: 'url', url: 'https://no-extractor.example.com' }), { question: 'q' })).resolves.toBeUndefined();
  });
});
