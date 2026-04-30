import { FrontierQueue } from '../frontier/FrontierQueue';
import { MutableResearchGraph } from '../graph/ResearchGraph';
import type { CrawlTarget, EvidenceItem, ResearchState, ResearchTask } from '../types';
import { DEFAULT_RESEARCH_BUDGET } from '../defaults';

export function makeTask(overrides: Partial<ResearchTask> = {}): ResearchTask {
  return {
    id: 'task-test',
    question: 'Compare free self-hosted search tools for AI agents',
    objective: 'compare_options',
    successCriteria: ['metasearch', 'local indexing', 'page extraction', 'limitations', 'citations'],
    ...overrides,
  };
}

export function makeTarget(overrides: Partial<CrawlTarget> = {}): CrawlTarget {
  return {
    id: 'target-1',
    kind: 'search_query',
    query: 'free self hosted search',
    priority: 0.7,
    depth: 0,
    reason: 'Seed query',
    createdAt: '2026-04-30T00:00:00.000Z',
    ...overrides,
  } as CrawlTarget;
}

export function makeEvidence(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    id: 'evidence-1',
    url: 'https://docs.example.com/search',
    normalizedUrl: 'https://docs.example.com/search',
    title: 'Search documentation',
    text: 'Metasearch, local indexing, page extraction, limitations, and citations for AI agents.',
    sourceType: 'web_page',
    discoveredByTargetId: 'target-1',
    depth: 0,
    extractedAt: '2026-04-30T00:00:00.000Z',
    citationId: 1,
    quality: {
      relevance: 0.9,
      authority: 0.8,
      freshness: 0.8,
      informationGain: 0.8,
      overall: 0.84,
    },
    ...overrides,
  };
}

export function makeState(overrides: Partial<ResearchState> = {}): ResearchState {
  const task = overrides.task ?? makeTask();
  const frontier = overrides.frontier ?? new FrontierQueue({ maxSize: DEFAULT_RESEARCH_BUDGET.maxFrontierSize });
  return {
    id: 'run-test',
    task,
    budget: { ...DEFAULT_RESEARCH_BUDGET, ...(overrides.budget ?? {}) },
    frontier,
    visited: [],
    evidence: [],
    citations: [],
    claims: [],
    gaps: [],
    decisions: [],
    graph: new MutableResearchGraph(),
    errors: [],
    counters: {
      iterations: 0,
      searchQueriesExecuted: 0,
      urlsFetched: 0,
      ...(overrides.counters ?? {}),
    },
    startedAt: Date.now(),
    deadlineAt: Date.now() + DEFAULT_RESEARCH_BUDGET.maxRuntimeMs,
    ...overrides,
  };
}
