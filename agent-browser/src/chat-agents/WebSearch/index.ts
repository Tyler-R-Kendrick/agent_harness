import type { ToolDescriptor } from '../../tools';

export const WEB_SEARCH_AGENT_ID = 'web-search-agent';
export const WEB_SEARCH_AGENT_LABEL = 'Web Search Agent';

export interface BuildWebSearchAgentPromptOptions {
  task: string;
  descriptors: ToolDescriptor[];
  location?: string;
}

export interface WebSearchAgentEvalResult {
  passed: boolean;
  score: number;
  checks: {
    usesRegisteredSearch: boolean;
    hasHttpFallback: boolean;
    readsAndValidatesSources: boolean;
    avoidsPrematureElicitation: boolean;
    iteratesQueries: boolean;
  };
}

export function selectWebSearchAgentTools(descriptors: ToolDescriptor[], _goal: string): string[] {
  const searchTools = descriptors.filter(isRegisteredSearchTool);
  const pageReaders = descriptors.filter(isWebPageReader);
  const fallbacks = descriptors.filter(isHttpFallbackTool);
  return uniqueIds([...searchTools, ...pageReaders, ...fallbacks]);
}

export function buildWebSearchAgentPrompt({
  task,
  descriptors,
  location,
}: BuildWebSearchAgentPromptOptions): string {
  const selectedToolIds = selectWebSearchAgentTools(descriptors, task);
  const toolCatalog = descriptors
    .filter((descriptor) => selectedToolIds.includes(descriptor.id) || isElicitationTool(descriptor))
    .map((descriptor) => `- ${descriptor.id}: ${descriptor.label} - ${descriptor.description}`)
    .join('\n');

  return [
    `Role: ${WEB_SEARCH_AGENT_ID} chat-agent`,
    `Mission: answer external, current, local, or recommendation questions with source-backed web evidence.`,
    `User task: ${task}`,
    location ? `Resolved location: ${location}` : null,
    '',
    'Available search path:',
    toolCatalog || '- No dedicated tools listed; use any registered HTTP, curl, fetch, or CLI-capable tool if present.',
    '',
    'Operating policy:',
    '1. Use a registered web search tool first when one is available, especially webmcp:search_web.',
    '2. Read result pages with webmcp:read_web_page or an equivalent HTTP client before promoting entity names.',
    '3. If a search tool returns unavailable, empty, 4xx, 5xx, or malformed output, immediately try another registered search tool, then cli with curl or node fetch against an available HTTP endpoint.',
    '4. Iterate queries at least once when results are weak: start broad, then search names near the resolved location or with source-specific constraints.',
    '5. Validate sufficiency before answering: reject page chrome, article metadata, navigation labels, generic categories, and entities that do not match the requested subject.',
    '6. Do not ask the user for a search source or candidate list until every registered web search, page-read, HTTP client, curl, fetch, and CLI fallback has failed.',
    '7. Final answers must be concise, source-backed, and include links or source names for each recommended entity when links are available.',
    '',
    'Improvement notes: ReAct-style action/observation loops, iterative retrieval-generation, and self-checking retrieval sufficiency are required for this agent.',
  ].filter((line): line is string => line !== null).join('\n');
}

export function evaluateWebSearchAgentPrompt({
  prompt,
  selectedToolIds,
}: {
  prompt: string;
  selectedToolIds: string[];
}): WebSearchAgentEvalResult {
  const checks = {
    usesRegisteredSearch: selectedToolIds.some((toolId) => /search/i.test(toolId))
      ? /webmcp:search_web|registered web search/i.test(prompt)
      : /Use a registered web search tool first when one is available/i.test(prompt),
    hasHttpFallback: selectedToolIds.some((toolId) => /cli|curl|http|fetch/i.test(toolId)) && /\b(?:curl|fetch|HTTP client|cli)\b/i.test(prompt),
    readsAndValidatesSources: /read result pages|read_web_page/i.test(prompt) && /reject page chrome|source-backed/i.test(prompt),
    avoidsPrematureElicitation: /Do not ask the user for a search source/i.test(prompt) && /every registered web search/i.test(prompt),
    iteratesQueries: /Iterate queries/i.test(prompt) && /start broad/i.test(prompt),
  };
  const passedChecks = Object.values(checks).filter(Boolean).length;
  return {
    passed: passedChecks === Object.keys(checks).length,
    score: passedChecks / Object.keys(checks).length,
    checks,
  };
}

function isRegisteredSearchTool(descriptor: ToolDescriptor): boolean {
  if (descriptor.id === 'webmcp:local_web_research') return false;
  const haystack = descriptorText(descriptor);
  return /\bsearch\b/i.test(haystack) && /\bweb\b/i.test(haystack) && !isElicitationTool(descriptor);
}

function isWebPageReader(descriptor: ToolDescriptor): boolean {
  return /\bread\b/i.test(descriptorText(descriptor)) && /\bweb\b|\bpage\b/i.test(descriptorText(descriptor));
}

function isHttpFallbackTool(descriptor: ToolDescriptor): boolean {
  if (descriptor.id === 'webmcp:local_web_research') return false;
  const haystack = descriptorText(descriptor);
  return descriptor.id === 'cli' || /\b(?:curl|http client|fetch|shell command|command)\b/i.test(haystack);
}

function isElicitationTool(descriptor: ToolDescriptor): boolean {
  return /elicit|ask.+user|user input/i.test(descriptorText(descriptor));
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

function uniqueIds(descriptors: ToolDescriptor[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const descriptor of descriptors) {
    if (isElicitationTool(descriptor) || seen.has(descriptor.id)) continue;
    seen.add(descriptor.id);
    ids.push(descriptor.id);
  }
  return ids;
}
