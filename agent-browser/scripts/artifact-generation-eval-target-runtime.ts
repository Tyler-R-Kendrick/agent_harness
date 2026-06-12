import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ToolSet } from 'ai';
import { createStaticToolPlan, type ToolAgentRuntime } from '../src/tool-agents/tool-agent/index.ts';
import type { ToolDescriptor } from '../src/tools/index.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const casesPath = path.join(appRoot, 'evals/artifact-generation/cases.jsonl');

const artifactDescriptor: ToolDescriptor = {
  id: 'webmcp:create_artifact',
  label: 'Create artifact',
  description: 'Create a standalone artifact with one or more files mounted under //artifacts.',
  group: 'built-in',
  groupLabel: 'Built-In',
  subGroup: 'artifacts-mcp',
  subGroupLabel: 'Artifacts',
};

const searchDescriptor: ToolDescriptor = {
  id: 'webmcp:search_web',
  label: 'Search web',
  description: 'Search the web for current external facts and local recommendations.',
  group: 'built-in',
  groupLabel: 'Built-In',
  subGroup: 'web-search-mcp',
  subGroupLabel: 'Search',
};

const runtime: ToolAgentRuntime = {
  tools: {
    [artifactDescriptor.id]: { execute: async () => ({}) },
    [searchDescriptor.id]: { execute: async () => ({}) },
  } as unknown as ToolSet,
  descriptors: [artifactDescriptor, searchDescriptor],
};

export type ArtifactGenerationEvalCase = {
  id: string;
  prompt: string;
  expectedSelectedToolIds: string[];
  expectedStepCount: number;
  expectedKind?: string;
  expectedPaths?: string[];
  forbiddenSelectedToolIds?: string[];
  forbiddenContentPhrases?: string[];
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

export async function loadArtifactGenerationCases(): Promise<ArtifactGenerationEvalCase[]> {
  const content = await readFile(casesPath, 'utf8');
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as ArtifactGenerationEvalCase);
}

export function runArtifactGenerationEvalCase(testCase: ArtifactGenerationEvalCase) {
  const plan = createStaticToolPlan(runtime, testCase.prompt);
  const step = plan.steps[0];
  const inputTemplate = step?.kind === 'call-tool' ? step.inputTemplate as {
    kind?: string;
    files?: Array<{ path: string }>;
  } : {};
  const filePaths = Array.isArray(inputTemplate.files)
    ? inputTemplate.files.map((file) => file.path)
    : [];
  const timestamp = new Date(0).toISOString();
  const toolCalls: EvalToolCall[] = step?.kind === 'call-tool'
    ? [{
      id: 'call-1',
      tool: step.toolId,
      input: inputTemplate,
      output: {
        kind: inputTemplate.kind ?? null,
        filePaths,
      },
      timestamp,
      duration_ms: 1,
    }]
    : [];

  const content = [
    `Artifact generation decision for ${testCase.id}`,
    `Prompt: ${testCase.prompt}`,
    `Selected tools: ${plan.selectedToolIds.join(', ') || '(none)'}`,
    `Step count: ${plan.steps.length}`,
    `Artifact kind: ${inputTemplate.kind ?? '(none)'}`,
    `Artifact files: ${filePaths.join(', ') || '(none)'}`,
  ].join('\n');

  return {
    content,
    selectedToolIds: plan.selectedToolIds,
    stepCount: plan.steps.length,
    kind: inputTemplate.kind ?? null,
    filePaths,
    toolCalls,
  };
}

async function main() {
  const evalId = argValue('--eval-id');
  const outputFile = argValue('--out') ?? argValue('--output');

  if (!evalId || !outputFile) {
    throw new Error('artifact-generation-eval-target requires --eval-id and --out.');
  }

  const testCases = await loadArtifactGenerationCases();
  const testCase = testCases.find((candidate) => candidate.id === evalId);
  if (!testCase) {
    throw new Error(`No artifact-generation eval case found for ${evalId}.`);
  }

  const result = runArtifactGenerationEvalCase(testCase);
  await writeFile(outputFile, JSON.stringify({
    output: [{
      role: 'assistant',
      content: result.content,
      tool_calls: result.toolCalls,
      metadata: {
        selectedToolIds: result.selectedToolIds,
        stepCount: result.stepCount,
        kind: result.kind,
        filePaths: result.filePaths,
      },
    }],
    duration_ms: result.toolCalls.length,
    token_usage: { input: 60, output: Math.max(1, result.content.length), cached: 0 },
  }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
