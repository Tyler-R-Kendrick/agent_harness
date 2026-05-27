import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ToolSet } from 'ai';
import type { ModelMessage } from '@ai-sdk/provider-utils';
import type { BusEntryStep } from '../src/types';
import type { AgentRunResult } from '../src/services/agentRunner';
import { runConfiguredExecutorAgent } from '../src/services/executorAgent';
import { runLogActActorWorkflow, type LogActActorExecuteContext } from '../src/services/logactActorWorkflow';
import type { ToolDescriptor } from '../src/tools';
import type { ToolAgentRuntime, ToolPlan } from '../src/tool-agents/tool-agent';
import { buildSearchEvalCases } from './generate-search-eval-cases.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const casesPath = path.join(appRoot, 'evals/codi-staged-search-chat/cases.jsonl');

type EvalCase = {
  id: string;
  input: string;
  criteria?: string;
  expected_output?: string;
};

type ExpectedContract = {
  fixtureId: string;
  expectedEntities?: string[];
  expectedLocations?: string[];
  badLabels?: string[];
  forbiddenLabels?: string[];
  requiredTools?: string[];
  minimumAcceptedEntities?: number;
};

type RuntimeFixtures = {
  memoryResult: unknown;
  browserLocationResult?: unknown;
  searchResults: Record<string, unknown>;
  pageResults: Record<string, unknown>;
};

type EvalToolCall = {
  id: string;
  tool: string;
  input: unknown;
  output?: unknown;
  timestamp: string;
  duration_ms: number;
};

type RunSummary = {
  provider: string;
  text: string;
  steps: number;
  failed?: boolean;
  blocked?: boolean;
  needsUserInput?: boolean;
  error?: string;
  maxAttemptFailure: boolean;
  toolNames: string[];
  toolCallCount: number;
  searchQueries: string[];
  reviewDecisions: Array<{ decision?: string; severity?: string; rules?: string }>;
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

function parseExpected(testCase: EvalCase): ExpectedContract {
  return JSON.parse(testCase.expected_output ?? '{}') as ExpectedContract;
}

function sourceContractFor(expected: ExpectedContract): Record<string, unknown> {
  const sourceCase = buildSearchEvalCases()
    .find((candidate: EvalCase) => candidate.id === expected.fixtureId);
  if (!sourceCase?.expected_output) {
    throw new Error(`No source search fixture found for ${expected.fixtureId}.`);
  }
  return JSON.parse(sourceCase.expected_output) as Record<string, unknown>;
}

function cloneFixtures(sourceContract: Record<string, unknown>): RuntimeFixtures {
  const fixtures = sourceContract.fixtures as RuntimeFixtures | undefined;
  if (!fixtures) throw new Error('Codi staged search eval source contract is missing fixtures.');
  const cloned = {
    memoryResult: fixtures.memoryResult,
    browserLocationResult: fixtures.browserLocationResult,
    searchResults: { ...fixtures.searchResults },
    pageResults: { ...fixtures.pageResults },
  };
  const nearbyTheaterResult = cloned.searchResults['nearby theaters Arlington Heights IL'];
  if (nearbyTheaterResult && !cloned.searchResults['nearby movie theaters Arlington Heights IL']) {
    cloned.searchResults['nearby movie theaters Arlington Heights IL'] = {
      ...(nearbyTheaterResult as Record<string, unknown>),
      query: 'nearby movie theaters Arlington Heights IL',
    };
  }
  if (nearbyTheaterResult && !cloned.searchResults['best movie theaters Arlington Heights IL']) {
    cloned.searchResults['best movie theaters Arlington Heights IL'] = {
      ...(nearbyTheaterResult as Record<string, unknown>),
      query: 'best movie theaters Arlington Heights IL',
    };
  }
  const namedTheaterResult = cloned.searchResults['theaters names near Arlington Heights IL'];
  if (namedTheaterResult && !cloned.searchResults['movie theaters names near Arlington Heights IL']) {
    cloned.searchResults['movie theaters names near Arlington Heights IL'] = {
      ...(namedTheaterResult as Record<string, unknown>),
      query: 'movie theaters names near Arlington Heights IL',
    };
  }
  return cloned;
}

function descriptors(): ToolDescriptor[] {
  return [
    {
      id: 'webmcp:recall_user_context',
      label: 'Recall user context',
      description: 'Search app memory for saved city, neighborhood, location, and relevant preferences.',
      group: 'built-in',
      groupLabel: 'Built-In',
      subGroup: 'user-context-mcp',
      subGroupLabel: 'User Context',
    },
    {
      id: 'webmcp:read_browser_location',
      label: 'Read browser location',
      description: 'Read browser geolocation before asking the user.',
      group: 'built-in',
      groupLabel: 'Built-In',
      subGroup: 'user-context-mcp',
      subGroupLabel: 'User Context',
    },
    {
      id: 'webmcp:search_web',
      label: 'Search web',
      description: 'Search the web for external facts and local entity evidence.',
      group: 'built-in',
      groupLabel: 'Built-In',
      subGroup: 'web-search-mcp',
      subGroupLabel: 'Search',
    },
    {
      id: 'webmcp:read_web_page',
      label: 'Read web page',
      description: 'Read a web page and extract structured evidence, links, and entities.',
      group: 'built-in',
      groupLabel: 'Built-In',
      subGroup: 'web-search-mcp',
      subGroupLabel: 'Search',
    },
    {
      id: 'webmcp:request_secret',
      label: 'Request secret',
      description: 'Secret request tools that return secret-ref handles without exposing raw values.',
      group: 'built-in',
      groupLabel: 'Built-In',
      subGroup: 'secret-mcp',
      subGroupLabel: 'Secrets',
    },
  ];
}

function createRuntime(fixtures: RuntimeFixtures): { runtime: ToolAgentRuntime; descriptors: ToolDescriptor[] } {
  const toolDescriptors = descriptors();
  const tools: ToolSet = {
    'webmcp:recall_user_context': {
      execute: async () => fixtures.memoryResult,
    },
    'webmcp:read_browser_location': {
      execute: async () => fixtures.browserLocationResult ?? {
        status: 'unavailable',
        reason: 'No deterministic browser location fixture is configured.',
      },
    },
    'webmcp:search_web': {
      execute: async ({ query }: { query: string; limit?: number }) => (
        fixtures.searchResults[query] ?? fixtures.searchResults['*'] ?? {
          status: 'empty',
          query,
          results: [],
          reason: `No deterministic Codi staged search fixture matched "${query}".`,
        }
      ),
    },
    'webmcp:read_web_page': {
      execute: async ({ url }: { url: string }) => (
        fixtures.pageResults[url] ?? {
          status: 'unavailable',
          url,
          links: [],
          jsonLd: [],
          entities: [],
          reason: `No deterministic Codi staged search page fixture matched "${url}".`,
        }
      ),
    },
    'webmcp:request_secret': {
      execute: async () => ({
        status: 'refused',
        reason: 'Secret values are not needed for this public local search eval.',
      }),
    },
  } as ToolSet;
  return { descriptors: toolDescriptors, runtime: { tools, descriptors: toolDescriptors } };
}

function createPlan(testCase: EvalCase, toolDescriptors: ToolDescriptor[]): ToolPlan {
  const selectedToolIds = toolDescriptors.map((descriptor) => descriptor.id);
  return {
    version: 1,
    goal: testCase.input,
    selectedToolIds,
    steps: [],
    createdToolFiles: [],
    actorToolAssignments: {
      executor: selectedToolIds,
      'tool-agent': [],
      'student-driver': [],
      'adversary-driver': [],
      'voter:teacher': [],
      'judge-decider': [],
    },
  };
}

function instructionsFor(toolDescriptors: ToolDescriptor[]): string {
  return [
    'Run the staged Codi local-model search chat flow with adversary tool review active.',
    'Resolve location for nearby requests, use web search and page reads, and answer with source-backed entity links.',
    'Available Tools:',
    ...toolDescriptors.map((descriptor) => (
      `- ${descriptor.id} (${descriptor.label}) - ${descriptor.description}`
    )),
    'Selected tool ids:',
    toolDescriptors.map((descriptor) => descriptor.id).join(', '),
  ].join('\n');
}

function createEventRecorder(): {
  calls: EvalToolCall[];
  busEntries: BusEntryStep[];
  voterUpdates: Array<Record<string, unknown>>;
  callbacks: {
    onToolCall: (toolName: string, args: unknown, toolCallId?: string) => void;
    onToolResult: (toolName: string, args: unknown, result: unknown, isError?: boolean, toolCallId?: string) => void;
    onBusEntry: (entry: BusEntryStep) => void;
    onVoterStepUpdate: (id: string, update: Record<string, unknown>) => void;
  };
} {
  const calls: EvalToolCall[] = [];
  const busEntries: BusEntryStep[] = [];
  const voterUpdates: Array<Record<string, unknown>> = [];
  const byId = new Map<string, EvalToolCall>();
  let index = 0;
  const appendCall = (tool: string, input: unknown, id = `call-${index + 1}-${tool.replace(/[^a-z0-9]+/gi, '-')}`) => {
    index += 1;
    const call: EvalToolCall = {
      id,
      tool,
      input,
      timestamp: new Date(index).toISOString(),
      duration_ms: 1,
    };
    calls.push(call);
    byId.set(id, call);
    return call;
  };

  return {
    calls,
    busEntries,
    voterUpdates,
    callbacks: {
      onToolCall(toolName, args, toolCallId) {
        appendCall(toolName, args, toolCallId);
      },
      onToolResult(toolName, args, result, isError, toolCallId) {
        const call = (toolCallId ? byId.get(toolCallId) : undefined) ?? appendCall(toolName, args, toolCallId);
        call.output = isError ? { error: result } : result;
      },
      onBusEntry(entry) {
        busEntries.push(entry);
        if (!entry.actorId || ![
          'search-analyzer',
          'validation-agent',
          'post-processor',
          'verification-agent',
        ].includes(entry.actorId)) {
          return;
        }
        appendCall(entry.actorId, {
          summary: entry.summary,
          payloadType: entry.payloadType,
        }).output = entry.detail;
      },
      onVoterStepUpdate(id, update) {
        voterUpdates.push({ id, ...update });
      },
    },
  };
}

function reviewDecisions(voterUpdates: Array<Record<string, unknown>>): RunSummary['reviewDecisions'] {
  return voterUpdates
    .filter((update) => String(update.id ?? '').includes('adversary-tool-review'))
    .map((update) => {
      const thought = String(update.thought ?? '');
      return {
        decision: thought.match(/Decision:\s*([^\n]+)/i)?.[1]?.trim(),
        severity: thought.match(/Severity:\s*([^\n]+)/i)?.[1]?.trim(),
        rules: thought.match(/Rules:\s*([^\n]+)/i)?.[1]?.trim(),
      };
    });
}

function summarizeRun(provider: string, result: AgentRunResult, recorder: ReturnType<typeof createEventRecorder>): RunSummary {
  const toolCalls = recorder.calls.filter((call) => call.tool.startsWith('webmcp:'));
  return {
    provider,
    text: result.text,
    steps: result.steps,
    failed: result.failed,
    blocked: result.blocked,
    needsUserInput: result.needsUserInput,
    error: result.error,
    maxAttemptFailure: /could not produce an executable plan|requires operator approval/i.test(result.text),
    toolNames: recorder.calls.map((call) => call.tool),
    toolCallCount: toolCalls.length,
    searchQueries: toolCalls
      .filter((call) => call.tool === 'webmcp:search_web')
      .map((call) => String((call.input as { query?: unknown }).query ?? '')),
    reviewDecisions: reviewDecisions(recorder.voterUpdates),
  };
}

async function runProvider(
  provider: 'local' | 'ghcp',
  testCase: EvalCase,
  expected: ExpectedContract,
  sourceContract: Record<string, unknown>,
): Promise<{ summary: RunSummary; calls: EvalToolCall[] }> {
  const fixtures = cloneFixtures(sourceContract);
  const { runtime, descriptors: toolDescriptors } = createRuntime(fixtures);
  const plan = createPlan(testCase, toolDescriptors);
  const recorder = createEventRecorder();
  const sourceMessages = sourceContract.messages as ModelMessage[] | undefined;
  const messages = sourceMessages ?? [{ role: 'user' as const, content: testCase.input }];

  const result = await runLogActActorWorkflow({
    messages,
    instructions: instructionsFor(toolDescriptors),
    workspaceName: 'Research',
    plan,
    selectedDescriptors: toolDescriptors,
    selectedTools: runtime.tools,
    verificationCriteria: [
      testCase.criteria ?? '',
      'Final answer must list real nearby candidates with source-backed links.',
      'Final answer must not contain adversary approval failure text.',
      'Final answer must reject page chrome and navigation labels as entities.',
    ].filter(Boolean),
    validationContract: (sourceContract.validationContract as never) ?? undefined,
    maxExecutionAttempts: 3,
    adversaryToolReviewSettings: { enabled: true, strictMode: false, customRules: [] },
    execute: (context: LogActActorExecuteContext) => runConfiguredExecutorAgent({
      model: {
        provider,
        modelId: provider === 'local' ? 'qwen3-0.6b-onnx' : 'gpt-4.1',
      } as never,
      tools: context.selectedTools,
      toolDescriptors: context.selectedDescriptors,
      instructions: 'Execute the committed staged search plan against deterministic WebMCP fixtures.',
      messages,
      workspaceName: 'Research',
      capabilities: { contextWindow: 4096, maxOutputTokens: 512 },
      runtime,
    }, context.plan, context.selectedDescriptors, context.selectedTools, recorder.callbacks, context),
  }, recorder.callbacks);

  return { summary: summarizeRun(provider, result, recorder), calls: recorder.calls };
}

async function runCase(testCase: EvalCase): Promise<{ content: string; toolCalls: EvalToolCall[] }> {
  const expected = parseExpected(testCase);
  const sourceContract = sourceContractFor(expected);
  const codi = await runProvider('local', testCase, expected, sourceContract);
  const ghcp = await runProvider('ghcp', testCase, expected, sourceContract);
  const metadata = {
    caseId: testCase.id,
    codi: codi.summary,
    ghcp: ghcp.summary,
  };
  return {
    content: codi.summary.text,
    toolCalls: [
      ...codi.calls.filter((call) => call.tool.startsWith('webmcp:')),
      {
        id: 'codi-staged-search-summary',
        tool: 'codi-staged-search',
        input: { testId: testCase.id },
        output: { metadata, run: codi.summary },
        timestamp: new Date(10_000).toISOString(),
        duration_ms: codi.summary.toolCallCount,
      },
      {
        id: 'ghcp-tool-calling-baseline-summary',
        tool: 'ghcp-tool-calling-baseline',
        input: { testId: testCase.id },
        output: { run: ghcp.summary },
        timestamp: new Date(10_001).toISOString(),
        duration_ms: ghcp.summary.toolCallCount,
      },
    ],
  };
}

const evalId = argValue('--eval-id');
const outputFile = argValue('--out') ?? argValue('--output');

if (!evalId || !outputFile) {
  throw new Error('codi-staged-search-eval-target requires --eval-id and --out.');
}

const cases = await loadCases();
const testCase = cases.find((candidate) => candidate.id === evalId);
if (!testCase) {
  throw new Error(`No Codi staged search eval case found for ${evalId}.`);
}

const result = await runCase(testCase);
await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, JSON.stringify({
  output: [{
    role: 'assistant',
    content: result.content,
    tool_calls: result.toolCalls,
  }],
  duration_ms: result.toolCalls.length,
  token_usage: { input: Math.max(1, testCase.input.length), output: Math.max(1, result.content.length), cached: 0 },
}, null, 2));
