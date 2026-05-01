import type { ToolDescriptor } from '../../tools';
import { LocalWebResearchAgent, runLocalWebResearchAgent } from './local-web-research/agent';
import { buildCitations } from './local-web-research/citations';
import { chunkExtractedPages } from './local-web-research/chunkText';
import { MemoryCache } from './local-web-research/memoryCache';
import { normalizeUrl } from './local-web-research/normalizeUrl';
import { planSearchQueries } from './local-web-research/planSearchQueries';
import { rankEvidenceChunks } from './local-web-research/rankEvidenceChunks';
import {
  DuckDuckGoInstantSearchProvider,
  PerplexitySearchProvider,
  SearxngSearchProvider,
  TavilySearchProvider,
  createSearchProviderFromConfig,
} from './local-web-research/searchProviders';
import { assertPublicHttpUrl } from './local-web-research/ssrfGuard';

export const LOCAL_WEB_RESEARCH_AGENT_ID = 'local-web-research-agent';
export const LOCAL_WEB_RESEARCH_AGENT_LABEL = 'Local Web Research Agent';
export const LOCAL_WEB_RESEARCH_TOOL_ID = 'webmcp:local_web_research';

export interface BuildLocalWebResearchAgentPromptOptions {
  task: string;
  descriptors: ToolDescriptor[];
}

export interface LocalWebResearchAgentEvalResult {
  passed: boolean;
  score: number;
  checks: {
    usesLocalResearchTool: boolean;
    usesSearxngAndExtraction: boolean;
    supportsConfiguredProviders: boolean;
    resolvesSdkCredentialsWithSecretRefs: boolean;
    ranksEvidenceWithCitations: boolean;
    handlesRecoverableFailures: boolean;
    participatesInFanIn: boolean;
  };
}

export function selectLocalWebResearchAgentTools(descriptors: ToolDescriptor[], _goal: string): string[] {
  return descriptors
    .filter((descriptor) => descriptor.id === LOCAL_WEB_RESEARCH_TOOL_ID || /local.+web.+research|searxng|evidence.+citations/i.test(descriptorText(descriptor)))
    .filter((descriptor) => !isElicitationTool(descriptor))
    .map((descriptor) => descriptor.id)
    .filter((toolId, index, ids) => ids.indexOf(toolId) === index);
}

export function buildLocalWebResearchAgentPrompt({
  task,
  descriptors,
}: BuildLocalWebResearchAgentPromptOptions): string {
  const selectedToolIds = selectLocalWebResearchAgentTools(descriptors, task);
  const toolCatalog = descriptors
    .filter((descriptor) => selectedToolIds.includes(descriptor.id))
    .map((descriptor) => `- ${descriptor.id}: ${descriptor.label} - ${descriptor.description}`)
    .join('\n');

  return [
    `Role: ${LOCAL_WEB_RESEARCH_AGENT_ID} chat-agent`,
    'Mission: provide free local web research using local/self-hosted services by default, with configured provider support when the workflow supplies it.',
    `User task: ${task}`,
    '',
    'Available local research path:',
    toolCatalog || '- webmcp:local_web_research: Local web research - Query SearXNG or a configured provider, extract pages, rank evidence, and return citations.',
    '',
    'Operating policy:',
    '1. Use webmcp:local_web_research for SearXNG, Perplexity SDK, Tavily SDK, or DuckDuckGo Instant search, page extraction, deterministic ranking, and citations.',
    '2. Run parallel to web-search-agent whenever the normal web search path is available.',
    '3. Participate in the search fan-in merge so local research evidence and web-search-agent results can be reranked before final answer selection.',
    '4. Keep synthesis optional and disabled by default; never return uncited generated claims.',
    '5. Preserve structured errors for search, extraction, timeout, CORS, and local service failures instead of hiding them.',
    '6. Keep SSRF protection on by default and do not extract private/internal URLs unless explicitly configured.',
    '7. Return search results, extracted evidence chunks, citations, recoverable errors, timings, and optional answer text.',
    '8. Resolve SDK credentials through secretRefs; DuckDuckGo Instant requires no credential.',
    '',
    'Default free local services:',
    '- SearXNG: http://localhost:8080',
    '- Ollama: http://localhost:11434 (optional)',
    '',
    'Configured provider options:',
    '- Perplexity SDK: secretRefs-backed search credentials.',
    '- Tavily SDK: secretRefs-backed search credentials.',
    '- DuckDuckGo Instant: credential-free instant answer API.',
    '',
    'Quality bar: evidence must be deterministically ranked, citations must map to normalized source URLs, and fan-in must happen before candidate validation.',
  ].join('\n');
}

export function evaluateLocalWebResearchAgentPolicy({
  prompt,
  selectedToolIds,
}: {
  prompt: string;
  selectedToolIds: string[];
}): LocalWebResearchAgentEvalResult {
  const checks = {
    usesLocalResearchTool: selectedToolIds.includes(LOCAL_WEB_RESEARCH_TOOL_ID) && /webmcp:local_web_research/.test(prompt),
    usesSearxngAndExtraction: /SearXNG/i.test(prompt) && /page extraction|extract pages/i.test(prompt),
    supportsConfiguredProviders: /Perplexity SDK/.test(prompt) && /Tavily SDK/.test(prompt) && /DuckDuckGo Instant/.test(prompt),
    resolvesSdkCredentialsWithSecretRefs: /SDK credentials/i.test(prompt) && /secretRefs/.test(prompt),
    ranksEvidenceWithCitations: /deterministically ranked|deterministic ranking/i.test(prompt) && /citations/i.test(prompt),
    handlesRecoverableFailures: /structured errors/i.test(prompt) && /timeout, CORS/i.test(prompt),
    participatesInFanIn: /parallel to web-search-agent/i.test(prompt) && /fan-in merge/i.test(prompt) && /rerank/i.test(prompt),
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
  LocalWebResearchAgent,
  MemoryCache,
  DuckDuckGoInstantSearchProvider,
  PerplexitySearchProvider,
  SearxngSearchProvider,
  TavilySearchProvider,
  assertPublicHttpUrl,
  buildCitations,
  chunkExtractedPages,
  createSearchProviderFromConfig,
  normalizeUrl,
  planSearchQueries,
  rankEvidenceChunks,
  runLocalWebResearchAgent,
};
export type {
  AgentCitation,
  AgentErrorInfo,
  AgentLogger,
  AgentWorkflowStep,
  Cache,
  EvidenceChunk,
  ExtractedPage,
  Extractor,
  SearchProvider,
  Synthesizer,
  WebResearchAgentConfig,
  WebResearchRunRequest,
  WebResearchRunResult,
  WebSearchResult,
} from './local-web-research/types';
