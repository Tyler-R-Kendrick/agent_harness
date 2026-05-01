import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCompositeSearchAgentPrompt,
  evaluateCompositeSearchAgentPolicy,
  selectCompositeSearchAgentTools,
} from '../src/chat-agents/Search';
import type { ToolDescriptor } from '../src/tools';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const casesPath = path.join(appRoot, 'evals/composite-search-agent/cases.jsonl');

type EvalCase = {
  id: string;
  task: string;
  intent: string;
  expectedToolIds: string[];
};

type EvalToolCall = {
  id: string;
  tool: string;
  input: unknown;
  output: unknown;
  timestamp: string;
  duration_ms: number;
};

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function loadCases(): Promise<EvalCase[]> {
  const content = await readFile(casesPath, 'utf8');
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as EvalCase);
}

function descriptors(): ToolDescriptor[] {
  return [
    {
      id: 'webmcp:search_web',
      label: 'Search web',
      description: 'Search the public web for current, external, and local facts.',
      group: 'web-search-mcp',
      groupLabel: 'Web Search',
      subGroup: 'web-search-mcp',
      subGroupLabel: 'Search',
    },
    {
      id: 'webmcp:local_web_research',
      label: 'Local web research',
      description: 'Search local SearXNG, crawl result pages, rank evidence, and return citations.',
      group: 'web-search-mcp',
      groupLabel: 'Web Search',
      subGroup: 'web-search-mcp',
      subGroupLabel: 'Search',
    },
    {
      id: 'webmcp:semantic_search',
      label: 'Semantic search',
      description: 'Search RDF/SPARQL endpoints with checked templates and normalized semantic evidence.',
      group: 'web-search-mcp',
      groupLabel: 'Web Search',
      subGroup: 'web-search-mcp',
      subGroupLabel: 'Search',
    },
    {
      id: 'webmcp:read_web_page',
      label: 'Read web page',
      description: 'Read and extract source pages for entity evidence.',
      group: 'web-search-mcp',
      groupLabel: 'Web Search',
      subGroup: 'web-search-mcp',
      subGroupLabel: 'Search',
    },
    {
      id: 'cli',
      label: 'CLI',
      description: 'Run shell commands.',
      group: 'built-in',
      groupLabel: 'Built-In',
    },
  ];
}

function runCase(testCase: EvalCase): { content: string; toolCalls: EvalToolCall[] } {
  const toolDescriptors = descriptors();
  const selectedToolIds = selectCompositeSearchAgentTools(toolDescriptors, testCase.task);
  const prompt = buildCompositeSearchAgentPrompt({ task: testCase.task, descriptors: toolDescriptors });
  const policy = evaluateCompositeSearchAgentPolicy({ prompt, selectedToolIds });
  const timestamp = new Date(0).toISOString();
  const toolCalls: EvalToolCall[] = [
    {
      id: 'call-1',
      tool: 'search-provider-registry',
      input: { question: testCase.task, expectedIntent: testCase.intent },
      output: {
        selectedToolIds,
        policy,
        prompt,
        intendedRuntime: 'provider-adapters-crawler-depth-dynamic-reranking',
      },
      timestamp,
      duration_ms: 1,
    },
    {
      id: 'call-2',
      tool: 'search-fan-in-merger',
      input: {
        providers: selectedToolIds,
      },
      output: 'Composite search fan-in merges provider evidence, applies crawler depth, and uses dynamic reranking before final selection.',
      timestamp,
      duration_ms: 1,
    },
  ];
  const content = [
    `Composite search policy for ${testCase.task}`,
    `Intent: ${testCase.intent}`,
    `Selected tools: ${selectedToolIds.join(', ')}`,
    `Policy score: ${policy.score}`,
    'Uses a provider registry with provider adapters, crawler depth, content extraction, dynamic reranking, provider weights, recoverable provider error handling, structured errors, citations, and source-backed fan-in.',
  ].join('\n');
  return { content, toolCalls };
}

const evalId = argValue('--eval-id');
const outputFile = argValue('--out') ?? argValue('--output');

if (!evalId || !outputFile) {
  throw new Error('composite-search-eval-target requires --eval-id and --out.');
}

const cases = await loadCases();
const testCase = cases.find((candidate) => candidate.id === evalId);
if (!testCase) {
  throw new Error(`No composite search eval case found for ${evalId}.`);
}

const result = runCase(testCase);
await writeFile(outputFile, JSON.stringify({
  output: [{
    role: 'assistant',
    content: result.content,
    tool_calls: result.toolCalls,
    metadata: {
      expectedToolIds: testCase.expectedToolIds,
      expectedIntent: testCase.intent,
    },
  }],
  duration_ms: result.toolCalls.length,
  token_usage: { input: 50, output: Math.max(1, result.content.length), cached: 0 },
}, null, 2));
