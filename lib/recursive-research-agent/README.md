# Recursive Research Agent

`@agent-harness/recursive-research-agent` is a bounded in-process research controller. It sits above one-shot search/extraction tools, manages a finite frontier, analyzes evidence gaps, decides whether deeper research is justified, and returns structured evidence, citations, gaps, decisions, visited resources, metrics, and a research graph.

## What It Does

- Seeds initial search and URL targets from a research request.
- Executes bounded targets with low concurrency.
- Fans in web, semantic, local-index, and extraction results through common evidence ingestion.
- Scores evidence quality, sufficiency, candidate links, and follow-up targets deterministically.
- Keeps decision logs, recoverable errors, visited resources, frontier state, and graph edges.
- Optionally calls an injected synthesizer using only gathered evidence.

## What It Does Not Do

- It is not a frontend, browser UI, PWA, or standalone crawler.
- It does not scrape search-engine result pages directly.
- It does not follow every link on a page.
- It does not require a paid API, cloud service, or LLM.
- It does not let unvalidated LLM JSON control recursion.
- It does not hide gaps, errors, or intermediate decisions.

## Relationship To Agent Browser

This package is the generic recursive research controller. The Agent Browser integration uses first-class chat-agents under `agent-browser/src/chat-agents/`:

- `WebSearch` owns normal web search.
- `LocalWebResearch` owns local SearXNG plus extraction and citation ranking.
- `SemanticSearch` owns RDF/SPARQL semantic search.
- `executionRequirements.ts` runs available branches in parallel and appends a `search-fan-in-merger` AgentBus entry before reranking.

## Usage

```ts
import { RecursiveResearchAgent } from '@agent-harness/recursive-research-agent';

const recursive = new RecursiveResearchAgent({
  tools: { webResearchAgent },
  onEvent: (event) => console.log(event.type, event),
});

const result = await recursive.run({
  question: 'Compare free self-hosted web search approaches for AI agents',
  objective: 'compare_options',
  successCriteria: [
    'metasearch',
    'local indexing',
    'page extraction',
    'limitations',
    'citations',
  ],
  budget: {
    maxIterations: 3,
    maxDepth: 2,
    maxFetchedPages: 10,
  },
});

console.log(result.finalAnswer);
console.log(result.evidence);
console.log(result.gaps);
console.log(result.decisions);
```

## Tool Contracts

The required tool is `webResearchAgent.run()`, which performs one bounded round of search, extraction, evidence ranking, and citation creation. Optional tools add semantic search, local-index search, direct URL extraction, and synthesis.

The controller treats all tool failures as recoverable target errors unless input validation fails. Targets never run without a budget, priority, depth, ID, and reason.

## Budget Configuration

Defaults live in `src/defaults.ts`:

```ts
{
  maxIterations: 4,
  maxDepth: 2,
  maxSearchQueries: 8,
  maxFetchedPages: 12,
  maxPagesPerDomain: 3,
  maxRuntimeMs: 90000,
  maxFrontierSize: 50,
  maxTargetsPerIteration: 3,
  targetSufficiencyScore: 0.78
}
```

Every recursive step checks depth, query/page counts, per-domain saturation, frontier size, elapsed runtime, and sufficiency.

## Events

`onEvent` receives:

- `started`
- `frontier_seeded`
- `iteration_started`
- `target_completed`
- `target_failed`
- `gaps_updated`
- `decision`
- `completed`

## Result Shape

Results include the task, optional final answer, evidence, citations, claims, gaps, visited resources, remaining frontier, decisions, graph JSON, structured errors, metrics, elapsed time, and metadata.

## Extension Points

- Semantic RDF/SPARQL search via `semanticSearchAgent`.
- Local-index search via `localIndexSearchAgent`.
- Scored link-following through `links/`.
- Optional LLM gap analysis with JSON validation and deterministic fallback.
- Persistence through caller-owned state/event handling.
- MCP or HTTP wrappers around the same tool contracts.

## Validation

```sh
npm --workspace @agent-harness/recursive-research-agent run test:coverage
```

The package enforces 100% coverage thresholds for statements, branches, functions, and lines.
