import type { ToolDescriptor } from '../../tools';
import { checkWikidataHealth } from './semantic-search/health';
import { classifySemanticSearchIntent } from './semantic-search/intents';
import { normalizeWikidataEntityResults, normalizeWikidataFactsResults } from './semantic-search/normalizers/wikidata';
import { rankSemanticSearchResults } from './semantic-search/ranking';
import { runRdfWebSearchAgent } from './semantic-search/agent';
import {
  buildWikidataClassInstancesQuery,
  buildWikidataEntitySearchQuery,
  buildWikidataFactsQuery,
  escapeSparqlString,
} from './semantic-search/templates/wikidata';

export const RDF_WEB_SEARCH_AGENT_ID = 'rdf-web-search-agent';
export const RDF_WEB_SEARCH_AGENT_LABEL = 'RDF Web Search Agent';
export const RDF_SEMANTIC_SEARCH_TOOL_ID = 'webmcp:semantic_search';

export interface BuildRdfWebSearchAgentPromptOptions {
  task: string;
  descriptors: ToolDescriptor[];
}

export interface RdfWebSearchAgentEvalResult {
  passed: boolean;
  score: number;
  checks: {
    usesSemanticTool: boolean;
    usesSafeTemplates: boolean;
    citesSources: boolean;
    handlesEndpointFailure: boolean;
    participatesInFanIn: boolean;
  };
}

export function selectRdfWebSearchAgentTools(descriptors: ToolDescriptor[], _goal: string): string[] {
  return descriptors
    .filter((descriptor) => descriptor.id === RDF_SEMANTIC_SEARCH_TOOL_ID || /semantic.+search|rdf|sparql|wikidata/i.test(descriptorText(descriptor)))
    .filter((descriptor) => !isElicitationTool(descriptor))
    .map((descriptor) => descriptor.id)
    .filter((toolId, index, ids) => ids.indexOf(toolId) === index);
}

export function buildRdfWebSearchAgentPrompt({
  task,
  descriptors,
}: BuildRdfWebSearchAgentPromptOptions): string {
  const selectedToolIds = selectRdfWebSearchAgentTools(descriptors, task);
  const toolCatalog = descriptors
    .filter((descriptor) => selectedToolIds.includes(descriptor.id))
    .map((descriptor) => `- ${descriptor.id}: ${descriptor.label} - ${descriptor.description}`)
    .join('\n');

  return [
    `Role: ${RDF_WEB_SEARCH_AGENT_ID} chat-agent`,
    'Mission: answer semantic open-data questions with normalized RDF results, scores, and citations.',
    `User task: ${task}`,
    '',
    'Available semantic path:',
    toolCatalog || '- webmcp:semantic_search: Semantic search - Query public RDF endpoints through checked templates.',
    '',
    'Endpoint registry:',
    '- Wikidata Query Service is enabled by default.',
    '- DBpedia is registered but disabled by default until browser CORS behavior is reliable.',
    '- Overpass is registered for future geospatial support; it is not RDF/SPARQL and is disabled by default.',
    '',
    'Operating policy:',
    '1. Use webmcp:semantic_search for QID facts, Class instances, Wikidata-style entity search, endpoint health, and public RDF lookups.',
    '2. Generate only safe SPARQL templates: escape user strings, validate QIDs, clamp LIMIT values, and never execute free-form generated queries.',
    '3. Template constraints: QID facts use wd:Q42-style entity IRIs; Class instances use wd:Q5-style class IRIs; invalid QIDs return clear errors.',
    '4. Return normalized results with source links, clickable citations, Wikidata IDs, descriptions, facts, and scores.',
    '5. Handle timeout, CORS, non-2xx, parse, and endpoint errors as structured errors so unsupported gracefully reaches the user.',
    '6. Use the cheap ASK health query to show latency and endpoint health when health is requested.',
    '7. Participate in the web search fan-in merge: run beside web search, then let the fan-in merge rerank web search and RDF semantic search evidence before final answer selection.',
    '8. Do not infer private location for Overpass; require explicit coordinates if that future path is enabled.',
    '',
    'Supported query examples:',
    '- Entity search: Azure OpenAI Service',
    '- QID facts: Douglas Adams Q42',
    '- Class instances: instances of Q5',
  ].join('\n');
}

export function evaluateRdfWebSearchAgentPolicy({
  prompt,
  selectedToolIds,
}: {
  prompt: string;
  selectedToolIds: string[];
}): RdfWebSearchAgentEvalResult {
  const checks = {
    usesSemanticTool: selectedToolIds.includes(RDF_SEMANTIC_SEARCH_TOOL_ID) && /webmcp:semantic_search/.test(prompt),
    usesSafeTemplates: /safe SPARQL templates/i.test(prompt) && /escape user strings/i.test(prompt) && /validate QIDs/i.test(prompt) && /clamp LIMIT/i.test(prompt),
    citesSources: /source links|clickable citations|Wikidata IDs/i.test(prompt),
    handlesEndpointFailure: /timeout, CORS, non-2xx, parse, and endpoint errors/i.test(prompt) && /structured errors/i.test(prompt),
    participatesInFanIn: /fan-in merge/i.test(prompt) && /web search and RDF semantic search/i.test(prompt) && /rerank/i.test(prompt),
  };
  const passedChecks = Object.values(checks).filter(Boolean).length;
  return {
    passed: passedChecks === Object.keys(checks).length,
    score: passedChecks / Object.keys(checks).length,
    checks,
  };
}

function descriptorText(descriptor: ToolDescriptor): string {
  return [
    descriptor.id,
    descriptor.label,
    descriptor.description,
    descriptor.group,
    descriptor.subGroup ?? '',
    descriptor.subGroupLabel ?? '',
  ].join(' ');
}

function isElicitationTool(descriptor: ToolDescriptor): boolean {
  return /elicit|ask.+user|user input/i.test(descriptorText(descriptor));
}

export {
  buildWikidataClassInstancesQuery,
  buildWikidataEntitySearchQuery,
  buildWikidataFactsQuery,
  checkWikidataHealth,
  classifySemanticSearchIntent,
  escapeSparqlString,
  normalizeWikidataEntityResults,
  normalizeWikidataFactsResults,
  rankSemanticSearchResults,
  runRdfWebSearchAgent,
};
export type { AgentAnswer, SearchIntent, SearchResult, SearchSource } from './semantic-search/types';
export type { EndpointConfig, EndpointKind } from './semantic-search/endpoints';
export type { EndpointHealth } from './semantic-search/health';
export type { SparqlJsonResult } from './semantic-search/types';
