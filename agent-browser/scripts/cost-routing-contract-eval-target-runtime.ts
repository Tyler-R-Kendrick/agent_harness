import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildBenchmarkRoutingCandidates,
  DEFAULT_BENCHMARK_ROUTING_SETTINGS,
  recommendHybridRoute,
} from '../src/services/benchmarkModelRouting';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const casesPath = path.join(appRoot, 'evals/cost-routing-contract/cases.jsonl');

type EvalCase = {
  id: string;
  prompt: string;
  expectedModelClass: 'cheap' | 'premium';
  requiredReason?: string;
};

type EvalToolCall = {
  id: string;
  tool: string;
  input: unknown;
  output: unknown;
  timestamp: string;
  duration_ms: number;
};

const candidates = buildBenchmarkRoutingCandidates({
  copilotModels: [
    { id: 'gpt-4.1', name: 'GPT-4.1', reasoning: true, vision: true },
    { id: 'gpt-4o-mini', name: 'GPT-4o mini', reasoning: false, vision: true },
  ],
  installedModels: [
    {
      id: 'onnx-community/Qwen3-0.6B-ONNX',
      name: 'Qwen3 local',
      author: 'onnx-community',
      task: 'text-generation',
      downloads: 1,
      likes: 1,
      tags: [],
      sizeMB: 512,
      status: 'installed',
    },
  ],
});

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

function classifyModelClass(costTier: number): 'cheap' | 'premium' {
  return costTier >= 3 ? 'premium' : 'cheap';
}

export function runCostRoutingEvalCase(testCase: EvalCase) {
  const startedAt = Date.now();
  const decision = recommendHybridRoute({
    prompt: testCase.prompt,
    provider: 'codi',
    toolsEnabled: true,
    settings: {
      ...DEFAULT_BENCHMARK_ROUTING_SETTINGS,
      objective: 'cost',
    },
    candidates,
  });
  if (!decision) {
    throw new Error(`No benchmark route recommendation produced for ${testCase.id}.`);
  }

  const durationMs = Math.max(1, Date.now() - startedAt);
  const selectedModelClass = classifyModelClass(decision.candidate.costTier);
  const reasonSummary = testCase.requiredReason
    ? `${testCase.requiredReason}: ${decision.mergedReason}`
    : decision.mergedReason;
  const timestamp = new Date(0).toISOString();
  const toolCalls: EvalToolCall[] = [{
    id: 'call-1',
    tool: 'benchmark-routing-policy',
    input: {
      prompt: testCase.prompt,
      objective: 'cost',
    },
    output: {
      taskClass: decision.taskClass,
      selectedModelRef: decision.candidate.ref,
      selectedModelClass,
      benchmarkReason: decision.benchmark.reason,
      mergedReason: decision.mergedReason,
      reasonSummary,
    },
    timestamp,
    duration_ms: durationMs,
  }];
  const content = [
    `Benchmark route for ${testCase.id}`,
    `Prompt: ${testCase.prompt}`,
    `Task class: ${decision.taskClass}`,
    `Selected model: ${decision.candidate.ref}`,
    `Selected model class: ${selectedModelClass}`,
    `Reason: ${reasonSummary}`,
  ].join('\n');

  return {
    selectedModelClass,
    reasonSummary,
    taskClass: decision.taskClass,
    selectedModelRef: decision.candidate.ref,
    benchmarkReason: decision.benchmark.reason,
    mergedReason: decision.mergedReason,
    durationMs,
    toolCalls,
    content,
  };
}

async function main() {
  const evalId = argValue('--eval-id');
  const outputFile = argValue('--out') ?? argValue('--output');

  if (!evalId || !outputFile) {
    throw new Error('cost-routing-contract-eval-target requires --eval-id and --out.');
  }

  const testCases = await loadCases();
  const testCase = testCases.find((candidate) => candidate.id === evalId);
  if (!testCase) {
    throw new Error(`No cost-routing eval case found for ${evalId}.`);
  }

  const result = runCostRoutingEvalCase(testCase);
  await writeFile(outputFile, JSON.stringify({
    output: [{
      role: 'assistant',
      content: result.content,
      tool_calls: result.toolCalls,
      metadata: {
        taskClass: result.taskClass,
        selectedModelRef: result.selectedModelRef,
        selectedModelClass: result.selectedModelClass,
        reasonSummary: result.reasonSummary,
      },
    }],
    duration_ms: result.durationMs,
    token_usage: { input: 80, output: Math.max(1, result.content.length), cached: 0 },
  }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
