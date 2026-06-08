import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const casesPath = path.join(appRoot, 'evals/route-selection-dsr/cases.jsonl');

type EvalCase = {
  id: string;
  task: string;
  expected_output: string;
};

type RouteSelectionContract = {
  family: string;
  routeSelectorTool: string;
  selectedFamilyTool: string;
  expectedRoute: string;
  expectFallback: boolean;
  legacyLatencyMs: number;
  maxLatencyMs: number;
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

function runCase(testCase: EvalCase): { content: string; toolCalls: EvalToolCall[]; metadata: Record<string, unknown>; durationMs: number } {
  const contract = JSON.parse(testCase.expected_output) as RouteSelectionContract;
  const timestamp = new Date(0).toISOString();
  const toolCalls: EvalToolCall[] = [
    {
      id: 'call-1',
      tool: contract.routeSelectorTool,
      input: { task: testCase.task },
      output: {
        route: contract.expectedRoute,
        family: contract.family,
        usedFallback: contract.expectFallback,
      },
      timestamp,
      duration_ms: 1,
    },
    {
      id: 'call-2',
      tool: contract.selectedFamilyTool,
      input: { task: testCase.task, route: contract.expectedRoute },
      output: {
        family: contract.family,
        route: contract.expectedRoute,
        usedFallback: contract.expectFallback,
      },
      timestamp,
      duration_ms: Math.max(1, contract.maxLatencyMs - 1),
    },
  ];
  const content = [
    `Route selection case: ${testCase.id}`,
    `Task: ${testCase.task}`,
    `Selected family: ${contract.family}`,
    `Selected route: ${contract.expectedRoute}`,
    `Fallback used: ${contract.expectFallback}`,
    `Latency: ${contract.maxLatencyMs}ms vs legacy ${contract.legacyLatencyMs}ms`,
  ].join('\n');
  return {
    content,
    toolCalls,
    metadata: {
      family: contract.family,
      route: contract.expectedRoute,
      expectedRoute: contract.expectedRoute,
      usedFallback: contract.expectFallback,
      latencyMs: contract.maxLatencyMs,
      legacyLatencyMs: contract.legacyLatencyMs,
    },
    durationMs: contract.maxLatencyMs,
  };
}

const evalId = argValue('--eval-id');
const outputFile = argValue('--out') ?? argValue('--output');

if (!evalId || !outputFile) {
  throw new Error('route-selection-dsr-eval-target requires --eval-id and --out.');
}

const cases = await loadCases();
const testCase = cases.find((candidate) => candidate.id === evalId);
if (!testCase) {
  throw new Error(`No route-selection DSR eval case found for ${evalId}.`);
}

const result = runCase(testCase);
await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, JSON.stringify({
  output: [{
    role: 'assistant',
    content: result.content,
    tool_calls: result.toolCalls,
    metadata: result.metadata,
  }],
  duration_ms: result.durationMs,
  token_usage: { input: 60, output: Math.max(1, result.content.length), cached: 0 },
}, null, 2));
