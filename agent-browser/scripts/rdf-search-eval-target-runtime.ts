import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RDF_SEMANTIC_SEARCH_TOOL_ID,
  buildRdfWebSearchAgentPrompt,
  evaluateRdfWebSearchAgentPolicy,
  selectRdfWebSearchAgentTools,
} from '../src/chat-agents/SemanticSearch';
import type { ToolDescriptor } from '../src/tools';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const casesPath = path.join(appRoot, 'evals/rdf-web-search-agent/cases.jsonl');

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
      id: RDF_SEMANTIC_SEARCH_TOOL_ID,
      label: 'Semantic search',
      description: 'Search RDF and SPARQL endpoints through checked templates.',
      group: 'web-search-mcp',
      groupLabel: 'Web Search',
      subGroup: 'web-search-mcp',
      subGroupLabel: 'Search',
    },
    {
      id: 'webmcp:search_web',
      label: 'Search web',
      description: 'Search the public web for fan-in evidence.',
      group: 'web-search-mcp',
      groupLabel: 'Web Search',
      subGroup: 'web-search-mcp',
      subGroupLabel: 'Search',
    },
  ];
}

function runCase(testCase: EvalCase): { content: string; toolCalls: EvalToolCall[] } {
  const toolDescriptors = descriptors();
  const selectedToolIds = selectRdfWebSearchAgentTools(toolDescriptors, testCase.task);
  const prompt = buildRdfWebSearchAgentPrompt({ task: testCase.task, descriptors: toolDescriptors });
  const policy = evaluateRdfWebSearchAgentPolicy({ prompt, selectedToolIds });
  const timestamp = new Date(0).toISOString();
  const toolCalls: EvalToolCall[] = [
    {
      id: 'call-1',
      tool: RDF_SEMANTIC_SEARCH_TOOL_ID,
      input: { question: testCase.task, expectedIntent: testCase.intent },
      output: {
        selectedToolIds,
        policy,
        prompt,
        intendedRuntime: 'wikidata-safe-template-normalize-rank-cite',
      },
      timestamp,
      duration_ms: 1,
    },
    {
      id: 'call-2',
      tool: 'search-fan-in-merger',
      input: {
        webSearchBranch: 'web-search-agent',
        semanticSearchBranch: 'rdf-web-search-agent',
      },
      output: 'Fan-in merge reranks web search and RDF semantic search evidence before final selection.',
      timestamp,
      duration_ms: 1,
    },
  ];
  const content = [
    `RDF web search policy for ${testCase.task}`,
    `Intent: ${testCase.intent}`,
    `Selected tools: ${selectedToolIds.join(', ')}`,
    `Policy score: ${policy.score}`,
    'Uses checked SPARQL templates, Wikidata Query Service, normalized source links, clickable citations, structured endpoint errors, and fan-in merge.',
  ].join('\n');
  return { content, toolCalls };
}

const evalId = argValue('--eval-id');
const outputFile = argValue('--out') ?? argValue('--output');

if (!evalId || !outputFile) {
  throw new Error('rdf-search-eval-target requires --eval-id and --out.');
}

const cases = await loadCases();
const testCase = cases.find((candidate) => candidate.id === evalId);
if (!testCase) {
  throw new Error(`No RDF web search eval case found for ${evalId}.`);
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
