import { getDefaultSemanticEndpoint } from './endpoints';
import { classifySemanticSearchIntent } from './intents';
import { normalizeWikidataEntityResults, normalizeWikidataFactsResults } from './normalizers/wikidata';
import { rankSemanticSearchResults } from './ranking';
import { runSparqlQuery } from './sparqlClient';
import {
  buildWikidataClassInstancesQuery,
  buildWikidataEntitySearchQuery,
  buildWikidataFactsQuery,
} from './templates/wikidata';
import type { AgentAnswer, SearchResult, SemanticSearchAgentConfig } from './types';

export async function runRdfWebSearchAgent(
  question: string,
  config: SemanticSearchAgentConfig & { signal?: AbortSignal } = {},
): Promise<AgentAnswer> {
  const started = Date.now();
  const query = question.trim();
  if (!query) {
    throw new TypeError('runRdfWebSearchAgent requires a non-empty question.');
  }
  const endpoint = getDefaultSemanticEndpoint();
  const intent = classifySemanticSearchIntent(query, { limit: config.defaultLimit });
  const endpointUrl = config.endpointUrl ?? endpoint.url;

  if (intent.kind === 'endpointHealth') {
    return {
      query,
      intent,
      endpointId: endpoint.id,
      generatedQuery: 'ASK { wd:Q42 wdt:P31 wd:Q5 }',
      results: [{
        id: 'wikidata-health',
        title: 'Wikidata Query Service health',
        url: 'https://query.wikidata.org/',
        source: 'wikidata',
        sourceName: 'Wikidata',
        description: 'Cheap ASK health query is available for endpoint validation.',
        score: 0.75,
      }],
      errors: [],
      elapsedMs: Date.now() - started,
    };
  }

  let generatedQuery = '';
  try {
    generatedQuery = queryForIntent(intent);
    const raw = await runSparqlQuery({
      endpointUrl,
      query: generatedQuery,
      fetchImpl: config.fetchImpl,
      signal: config.signal,
    });
    const normalized = normalizeForIntent(intent, raw);
    return {
      query,
      intent,
      endpointId: endpoint.id,
      generatedQuery,
      results: rankSemanticSearchResults({ question: query, results: normalized }).slice(0, intent.limit),
      errors: [],
      elapsedMs: Date.now() - started,
    };
  } catch (error) {
    return {
      query,
      intent,
      endpointId: endpoint.id,
      ...(generatedQuery ? { generatedQuery } : {}),
      results: [],
      errors: [{
        source: endpoint.id,
        message: error instanceof Error ? error.message : String(error),
      }],
      elapsedMs: Date.now() - started,
    };
  }
}

function queryForIntent(intent: ReturnType<typeof classifySemanticSearchIntent>): string {
  if (intent.kind === 'qidFacts') {
    return buildWikidataFactsQuery({ qid: intent.qid, limit: intent.limit });
  }
  if (intent.kind === 'classInstances') {
    return buildWikidataClassInstancesQuery({ qid: intent.qid, limit: intent.limit });
  }
  return buildWikidataEntitySearchQuery({ text: intent.text, limit: intent.limit });
}

function normalizeForIntent(
  intent: ReturnType<typeof classifySemanticSearchIntent>,
  raw: Parameters<typeof normalizeWikidataEntityResults>[0],
): SearchResult[] {
  if (intent.kind === 'qidFacts') {
    return normalizeWikidataFactsResults({ qid: intent.qid, result: raw });
  }
  return normalizeWikidataEntityResults(raw);
}
