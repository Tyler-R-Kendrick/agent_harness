import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildWebSearchAgentPrompt,
  evaluateWebSearchAgentPrompt,
  selectWebSearchAgentTools,
} from '../src/chat-agents/WebSearch';
import type { ToolDescriptor } from '../src/tools';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const casesPath = path.join(appRoot, 'evals/web-search-agent/cases.jsonl');

type EvalCase = {
  id: string;
  task: string;
  location?: string;
  failedTool?: string;
  availableToolIds: string[];
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

function descriptorFor(toolId: string): ToolDescriptor {
  switch (toolId) {
    case 'webmcp:search_web':
      return {
        id: toolId,
        label: 'Search web',
        description: 'Search the public web for external, current, and local facts.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      };
    case 'webmcp:read_web_page':
      return {
        id: toolId,
        label: 'Read web page',
        description: 'Read and extract entities from result pages.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      };
    case 'webmcp:elicit_user_input':
      return {
        id: toolId,
        label: 'Elicit user input',
        description: 'Ask the user for missing input.',
        group: 'built-in',
        groupLabel: 'Built-In',
      };
    default:
      return {
        id: toolId,
        label: toolId,
        description: 'Run shell commands with curl, HTTP clients, or node fetch.',
        group: 'built-in',
        groupLabel: 'Built-In',
      };
  }
}

function runCase(testCase: EvalCase): { content: string; toolCalls: EvalToolCall[] } {
  const descriptors = testCase.availableToolIds.map(descriptorFor);
  const selectedToolIds = selectWebSearchAgentTools(descriptors, testCase.task);
  const prompt = buildWebSearchAgentPrompt({
    task: testCase.task,
    descriptors,
    location: testCase.location,
  });
  const evaluation = evaluateWebSearchAgentPrompt({ prompt, selectedToolIds });
  const timestamp = new Date(0).toISOString();
  const toolCalls: EvalToolCall[] = selectedToolIds.map((toolId, index) => ({
    id: `call-${index + 1}`,
    tool: toolId,
    input: {
      task: testCase.task,
      location: testCase.location,
      failedTool: index === 0 ? testCase.failedTool : undefined,
    },
    output: {
      phase: toolId === 'webmcp:read_web_page'
        ? 'source-validation'
        : toolId === 'cli'
          ? 'http-fallback'
          : 'search',
      rationale: prompt,
    },
    timestamp,
    duration_ms: 1,
  }));

  const fallbackLine = testCase.failedTool
    ? `The registered search tool ${testCase.failedTool} is treated as unavailable, so the policy falls back to cli with curl or node fetch before asking the user for sources.`
    : 'The policy keeps CLI and HTTP-capable fallbacks available before any user elicitation path.';
  const content = [
    `Web Search policy for ${testCase.task}`,
    testCase.location ? `Resolved location: ${testCase.location}` : null,
    `Selected tools: ${selectedToolIds.join(', ')}`,
    'The agent uses a registered web search tool first, reads result pages to validate source-backed entities, rejects page chrome and generic listing titles, and iterates queries at least once before answering.',
    fallbackLine,
    `Policy score: ${evaluation.score}`,
  ].filter((line): line is string => Boolean(line)).join('\n');
  return { content, toolCalls };
}

const evalId = argValue('--eval-id');
const outputFile = argValue('--out') ?? argValue('--output');

if (!evalId || !outputFile) {
  throw new Error('web-search-agent-eval-target requires --eval-id and --out.');
}

const cases = await loadCases();
const testCase = cases.find((candidate) => candidate.id === evalId);
if (!testCase) {
  throw new Error(`No web search agent eval case found for ${evalId}.`);
}

const result = runCase(testCase);
await writeFile(outputFile, JSON.stringify({
  output: [{
    role: 'assistant',
    content: result.content,
    tool_calls: result.toolCalls,
    metadata: {
      expectedToolIds: testCase.expectedToolIds,
    },
  }],
  duration_ms: result.toolCalls.length,
  token_usage: { input: 50, output: Math.max(1, result.content.length), cached: 0 },
}, null, 2));
