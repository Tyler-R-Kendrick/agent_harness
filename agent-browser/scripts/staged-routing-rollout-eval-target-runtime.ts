import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildBenchmarkRoutingCandidates,
  DEFAULT_BENCHMARK_ROUTING_SETTINGS,
  recommendHybridRoute,
  type BenchmarkRoutingObjective,
  type BenchmarkTaskClassId,
} from '../src/services/benchmarkModelRouting.ts';
import type { AgentProvider } from '../src/chat-agents/types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const casesPath = path.join(appRoot, 'evals/staged-routing-rollout/cases.jsonl');

export type StagedRoutingRolloutEvalCase = {
  id: string;
  prompt: string;
  provider: AgentProvider;
  toolsEnabled: boolean;
  objective: BenchmarkRoutingObjective;
  expectedTaskClass: BenchmarkTaskClassId;
  expectedBenchmarkRef: string;
  expectedRouteRef: string;
  expectedModelClass: 'cheap' | 'premium';
  expectedOverrideApplied: boolean;
  expectedReasonIncludes: string[];
  requiresPolicyInvariants?: boolean;
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

export async function loadStagedRoutingRolloutCases(): Promise<StagedRoutingRolloutEvalCase[]> {
  const content = await readFile(casesPath, 'utf8');
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as StagedRoutingRolloutEvalCase);
}

export function buildStagedRoutingRolloutCandidates() {
  return buildBenchmarkRoutingCandidates({
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
}

function modelClassFromRef(ref: string): 'cheap' | 'premium' {
  return ref === 'ghcp:gpt-4.1' ? 'premium' : 'cheap';
}

const policyInvariants = [
  'Objective-weighted routes stay active when no premium-safe override triggers.',
  'Security, critical, or low-confidence prompts escalate to a premium-safe candidate set.',
  'Enforce mode only activates after staged rollout eval coverage passes.',
];

export function runStagedRoutingRolloutEvalCase(testCase: StagedRoutingRolloutEvalCase): { content: string; toolCalls: EvalToolCall[] } {
  const candidates = buildStagedRoutingRolloutCandidates();
  const settings = {
    ...DEFAULT_BENCHMARK_ROUTING_SETTINGS,
    objective: testCase.objective,
    minConfidence: 0.25,
    complexityThreshold: 0.55,
  };
  const route = recommendHybridRoute({
    prompt: testCase.prompt,
    provider: testCase.provider,
    toolsEnabled: testCase.toolsEnabled,
    settings,
    candidates,
  });

  if (!route) {
    throw new Error(`No staged routing rollout decision returned for ${testCase.id}.`);
  }

  const timestamp = new Date(0).toISOString();
  const overrideApplied = route.candidate.ref !== route.benchmark.candidate.ref;
  const toolCalls: EvalToolCall[] = [
    {
      id: 'call-1',
      tool: 'request-complexity-router',
      input: {
        prompt: testCase.prompt,
        provider: testCase.provider,
        toolsEnabled: testCase.toolsEnabled,
      },
      output: {
        taskClass: route.taskClass,
        tier: route.complexity.tier,
        score: route.complexity.score,
        confidence: route.complexity.confidence,
        reasons: route.complexity.reasons,
      },
      timestamp,
      duration_ms: 1,
    },
    {
      id: 'call-2',
      tool: 'benchmark-objective-router',
      input: { objective: testCase.objective },
      output: {
        taskClass: route.taskClass,
        benchmarkRef: route.benchmark.candidate.ref,
        benchmarkReason: route.benchmark.reason,
        objective: testCase.objective,
      },
      timestamp,
      duration_ms: 1,
    },
    {
      id: 'call-3',
      tool: 'routing-policy-guard',
      input: {
        minConfidence: settings.minConfidence,
        complexityThreshold: settings.complexityThreshold,
        escalationKeywords: settings.escalationKeywords,
      },
      output: {
        overrideApplied,
        mergedReason: route.mergedReason,
        complexityReasons: route.complexity.reasons,
      },
      timestamp,
      duration_ms: 1,
    },
    {
      id: 'call-4',
      tool: 'final-route-decision',
      input: { expectedRouteRef: testCase.expectedRouteRef },
      output: {
        taskClass: route.taskClass,
        selectedRef: route.candidate.ref,
        selectedModelClass: modelClassFromRef(route.candidate.ref),
        benchmarkRef: route.benchmark.candidate.ref,
        mergedReason: route.mergedReason,
      },
      timestamp,
      duration_ms: 1,
    },
  ];

  const content = [
    `Staged routing rollout decision for ${testCase.id}`,
    `Task class: ${route.taskClass}`,
    `Benchmark route: ${route.benchmark.candidate.ref}`,
    `Final route: ${route.candidate.ref}`,
    `Final model class: ${modelClassFromRef(route.candidate.ref)}`,
    `Merged reason: ${route.mergedReason}`,
    `Complexity reasons: ${route.complexity.reasons.join(', ') || 'none'}`,
    testCase.requiresPolicyInvariants ? 'Policy invariants:' : null,
    ...(testCase.requiresPolicyInvariants ? policyInvariants : []),
  ].filter((line): line is string => Boolean(line)).join('\n');

  return { content, toolCalls };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const evalId = argValue('--eval-id');
  const outputFile = argValue('--out') ?? argValue('--output');

  if (!evalId || !outputFile) {
    throw new Error('staged-routing-rollout-eval-target requires --eval-id and --out.');
  }

  const cases = await loadStagedRoutingRolloutCases();
  const testCase = cases.find((candidate) => candidate.id === evalId);
  if (!testCase) {
    throw new Error(`No staged routing rollout eval case found for ${evalId}.`);
  }

  const result = runStagedRoutingRolloutEvalCase(testCase);
  await writeFile(outputFile, JSON.stringify({
    output: [{
      role: 'assistant',
      content: result.content,
      tool_calls: result.toolCalls,
      metadata: {
        expectedTaskClass: testCase.expectedTaskClass,
        expectedBenchmarkRef: testCase.expectedBenchmarkRef,
        expectedRouteRef: testCase.expectedRouteRef,
        expectedModelClass: testCase.expectedModelClass,
        expectedOverrideApplied: testCase.expectedOverrideApplied,
        expectedReasonIncludes: testCase.expectedReasonIncludes,
        requiresPolicyInvariants: testCase.requiresPolicyInvariants ?? false,
      },
    }],
    duration_ms: result.toolCalls.length,
    token_usage: { input: 50, output: Math.max(1, result.content.length), cached: 0 },
  }, null, 2));
}
