# RDF Web Search Agent

The RDF Web Search Agent is a first-class Agent Browser chat-agent for semantic open-data search. It runs as `rdf-web-search-agent`, owns `webmcp:semantic_search`, and returns normalized evidence from checked RDF/SPARQL templates so the existing execution workflow can fan it into ordinary web-search results before candidate reranking.

## What It Does

- Classifies semantic requests into entity search, QID facts, class instances, or endpoint health.
- Uses bounded Wikidata SPARQL templates instead of free-form generated queries.
- Escapes user strings, validates `Q123` identifiers, and clamps limits.
- Normalizes entity URLs, descriptions, facts, source names, and scores.
- Returns structured endpoint errors for timeout, CORS, HTTP, and parse failures.
- Emits AgentBus ownership metadata through the execution-requirements tool path.
- Participates in the `search-fan-in-merger` step with the existing web-search and local web-research agents.

## What It Does Not Do

- It does not crawl arbitrary links.
- It does not scrape search-engine result pages.
- It does not require paid APIs or cloud infrastructure.
- It does not use an LLM for control flow.
- It does not execute caller-provided SPARQL.
- It does not infer private location for future Overpass/geospatial paths.

## How It Differs From Web Search

`web-search-agent` searches broad web sources and reads pages. `local-web-research-agent` uses local SearXNG plus extraction and ranking. `rdf-web-search-agent` searches public RDF data, primarily Wikidata, through deterministic templates. The three branches can run in parallel and merge through `search-fan-in-merger` before the normal candidate validator chooses final answer entities.

## Usage

```ts
import { runRdfWebSearchAgent } from '../chat-agents/SemanticSearch';

const result = await runRdfWebSearchAgent('facts for Q42', {
  defaultLimit: 8,
});

console.log(result.results);
console.log(result.errors);
```

The default tool wrapper is registered as `webmcp:semantic_search` by `createDefaultTools()`:

```ts
const tools = createDefaultTools(context);
const answer = await tools['webmcp:semantic_search'].execute?.({
  question: 'Ada Lovelace',
  limit: 5,
});
```

## Tool Contract

Input:

```ts
{
  question: string;
  limit?: number;
  endpointUrl?: string;
}
```

Output:

```ts
{
  query: string;
  intent: SearchIntent;
  endpointId?: string;
  generatedQuery?: string;
  results: SearchResult[];
  errors: Array<{ source?: string; message: string }>;
  elapsedMs: number;
}
```

## Budget And Safety

The agent clamps each SPARQL `LIMIT` to `1..25` and only builds one checked query per run. Recursive planning stays in `executionRequirements.ts`, where semantic results fan into the same bounded search candidate pipeline as web search. Endpoint failures remain recoverable and visible to AgentBus validation.

## Event And Bus Flow

The tool owner is `rdf-web-search-agent`, and tool result entries are tagged:

```ts
{
  actorId: 'rdf-web-search-agent',
  actorRole: 'search-agent',
  branchId: 'agent:rdf-web-search-agent',
  agentLabel: 'RDF Web Search Agent',
  modelProvider: 'deterministic-rdf'
}
```

The merge step appends a separate `search-fan-in-merger` entry describing web, local, and RDF result counts before reranking.

## Extension Points

- DBpedia is registered but disabled until endpoint behavior is validated.
- Overpass is registered as a future geospatial path and requires explicit coordinates.
- Additional RDF templates should be added as typed functions, with tests and AgentEvals cases.
- LLM synthesis can consume the resulting evidence later, but the RDF control flow remains deterministic.

## Validation

Run the focused checks:

```sh
npm --workspace agent-browser run test -- src/chat-agents/SemanticSearch/index.test.ts src/services/executionRequirementsSemanticSearch.test.ts evals/rdf-web-search-agent/rdfWebSearchAgent.eval.test.ts
npm --workspace agent-browser run eval:rdf-search
```
