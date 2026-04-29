import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ToolSet } from 'ai';
import type { Payload } from 'logact';
import { runConfiguredExecutorAgent } from '../src/services/executorAgent';
import { runLogActActorWorkflow, type LogActActorExecuteContext } from '../src/services/logactActorWorkflow';
import type { AgentRunResult } from '../src/services/agentRunner';
import type { BusEntryStep } from '../src/types';
import type { ToolDescriptor } from '../src/tools';
import type { ToolAgentRuntime, ToolPlan } from '../src/tool-agents/tool-agent';
import { WebPageBridge, WebSearchBridge } from '../server/searchMiddleware';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const casesPath = path.join(appRoot, 'evals/search-fulfillment/cases.jsonl');
const liveCasesPath = path.join(appRoot, 'evals/search-fulfillment/cases.live.jsonl');
const ADVERSARY_HARDENING = 'negative-rubric-technique: keyword-stuffing without task grounding';
const liveSearchBridge = new WebSearchBridge();
const livePageBridge = new WebPageBridge();

type EvalCase = {
  id: string;
  input: string;
  criteria?: string;
  expected_output?: string;
};

type SearchFixture = {
  status: 'found' | 'empty' | 'unavailable';
  query: string;
  results: Array<{ title: string; url: string; snippet: string }>;
  reason?: string;
};

type PageFixture = {
  status: 'read' | 'unavailable' | 'blocked';
  url: string;
  title?: string;
  text?: string;
  links: Array<{ text: string; url: string }>;
  jsonLd: unknown[];
  entities: Array<{ name: string; url?: string; evidence: string }>;
  reason?: string;
};

type RuntimeFixtures = {
  memoryResult: unknown;
  searchResults: Record<string, SearchFixture>;
  pageResults: Record<string, PageFixture>;
};

type EvalContract = {
  location?: string;
  expectedQuery?: string;
  semanticOnly?: boolean;
  fixtures?: RuntimeFixtures;
};

type EvalToolCall = {
  id: string;
  tool: string;
  input: unknown;
  output?: unknown;
  timestamp: string;
  duration_ms: number;
};

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function loadCases(live: boolean): Promise<EvalCase[]> {
  const content = await readFile(live ? liveCasesPath : casesPath, 'utf8');
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as EvalCase);
}

function parseContract(testCase: EvalCase): EvalContract {
  try {
    return JSON.parse(testCase.expected_output ?? '{}') as EvalContract;
  } catch {
    return {};
  }
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
  ];
}

function createRuntime(fixtures: RuntimeFixtures, live: boolean): { runtime: ToolAgentRuntime; descriptors: ToolDescriptor[] } {
  const toolDescriptors = descriptors();
  const tools: ToolSet = {
    'webmcp:recall_user_context': {
      execute: async () => fixtures.memoryResult,
    },
    'webmcp:search_web': {
      execute: async ({ query, limit }: { query: string; limit?: number }) => {
        if (live) return liveSearch(query, limit ?? 5);
        return fixtures.searchResults[query] ?? fixtures.searchResults['*'] ?? {
          status: 'empty' as const,
          query,
          results: [],
          reason: `No deterministic search fixture matched "${query}".`,
        };
      },
    },
    'webmcp:read_web_page': {
      execute: async ({ url }: { url: string }) => {
        if (live) return liveReadPage(url);
        return fixtures.pageResults[url] ?? {
          status: 'unavailable' as const,
          url,
          links: [],
          jsonLd: [],
          entities: [],
          reason: `No deterministic page fixture matched "${url}".`,
        };
      },
    },
  } as ToolSet;
  return {
    descriptors: toolDescriptors,
    runtime: {
      tools,
      descriptors: toolDescriptors,
    },
  };
}

async function liveSearch(query: string, limit: number): Promise<SearchFixture> {
  return liveSearchBridge.search({ query, limit });
}

async function liveReadPage(url: string): Promise<PageFixture> {
  return livePageBridge.read({ url });
}

function createPlan(testCase: EvalCase, toolDescriptors: ToolDescriptor[]): ToolPlan {
  return {
    version: 1,
    goal: testCase.input,
    selectedToolIds: toolDescriptors.map((descriptor) => descriptor.id),
    steps: [],
    createdToolFiles: [],
    actorToolAssignments: {
      executor: toolDescriptors.map((descriptor) => descriptor.id),
      'tool-agent': [],
      'student-driver': [],
      'adversary-driver': [],
      'voter:teacher': [],
      'judge-decider': [],
    },
  };
}

function createEventRecorder(): {
  calls: EvalToolCall[];
  callbacks: {
    onToolCall: (toolName: string, args: unknown, toolCallId?: string) => void;
    onToolResult: (toolName: string, args: unknown, result: unknown, isError?: boolean, toolCallId?: string) => void;
  };
  onBusEntry: (entry: BusEntryStep) => void;
} {
  const calls: EvalToolCall[] = [];
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
    callbacks: {
      onToolCall(toolName, args, toolCallId) {
        appendCall(toolName, args, toolCallId);
      },
      onToolResult(toolName, args, result, isError, toolCallId) {
        const call = (toolCallId ? byId.get(toolCallId) : undefined) ?? appendCall(toolName, args, toolCallId);
        call.output = isError ? { error: result } : result;
      },
    },
    onBusEntry(entry) {
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
  };
}

async function runCase(testCase: EvalCase, contract: EvalContract, live: boolean): Promise<AgentRunResult & { toolCalls: EvalToolCall[] }> {
  if (!contract.fixtures && !live) {
    throw new Error(`Search eval case ${testCase.id} is missing runtime fixtures.`);
  }
  const fixtures = contract.fixtures ?? {
    memoryResult: contract.location
      ? {
        status: 'found',
        query: 'location',
        memories: [{
          id: 'location.city',
          label: 'Saved city',
          value: contract.location,
          source: 'agentv-live-contract',
          updatedAt: new Date(0).toISOString(),
        }],
      }
      : { status: 'empty', memories: [] },
    searchResults: {},
    pageResults: {},
  };
  const { runtime, descriptors: toolDescriptors } = createRuntime(fixtures, live);
  const plan = createPlan(testCase, toolDescriptors);
  const recorder = createEventRecorder();

  const result = await runLogActActorWorkflow({
    messages: [{ role: 'user', content: testCase.input }],
    instructions: 'Run the production Agent Browser search fulfillment workflow for AgentEvals scoring.',
    workspaceName: 'Research',
    plan,
    selectedDescriptors: toolDescriptors,
    selectedTools: runtime.tools,
    negativeRubricTechniques: [ADVERSARY_HARDENING],
    verificationCriteria: [
      testCase.criteria ?? '',
      'Final answer must render only accepted structured candidates.',
      'Final answer must reject page chrome and navigation labels as entities.',
    ].filter(Boolean),
    maxExecutionAttempts: 1,
    execute: (context: LogActActorExecuteContext) => runConfiguredExecutorAgent({
      model: { provider: 'ghcp', modelId: 'gpt-4.1' } as never,
      tools: context.selectedTools,
      toolDescriptors: context.selectedDescriptors,
      instructions: 'Execute the committed LogAct plan against deterministic WebMCP fixtures.',
      messages: [{ role: 'user', content: testCase.input }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 4096, maxOutputTokens: 512 },
      runtime,
    }, context.plan, context.selectedDescriptors, context.selectedTools, recorder.callbacks, context),
  }, { onBusEntry: recorder.onBusEntry });

  return { ...result, toolCalls: recorder.calls };
}

const evalId = argValue('--eval-id');
const outputFile = argValue('--out') ?? argValue('--output');
const live = process.argv.includes('--live');

if (!evalId || !outputFile) {
  throw new Error('search-eval-target requires --eval-id and --out.');
}

const cases = await loadCases(live);
const testCase = cases.find((candidate) => candidate.id === evalId);
if (!testCase) {
  throw new Error(`No search eval case found for ${evalId}.`);
}

const result = await runCase(testCase, parseContract(testCase), live);
await writeFile(outputFile, JSON.stringify({
  output: [{
    role: 'assistant',
    content: result.text,
    tool_calls: result.toolCalls,
  }],
  duration_ms: result.toolCalls.length,
  token_usage: { input: 100, output: Math.max(1, result.text.length), cached: 0 },
}, null, 2));
