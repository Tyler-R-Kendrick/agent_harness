import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { InMemoryAgentBus, PayloadType } from 'logact';
import type { CompletionPayload, Entry, ICompletionChecker, IExecutor, IInferenceClient, IVoter, ResultPayload } from 'logact';
import { streamCodiChat } from '../src/chat-agents/Codi';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const casesPath = path.join(appRoot, 'evals/codi-general-chat/cases.jsonl');

interface CodiGeneralEvalCase {
  id: string;
  scenarioCategory: string;
  input: string;
  task: string;
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  scriptedAnswers: string[];
  registeredTools?: Array<{
    id: string;
    output: string;
    failureOutput?: string;
  }>;
  expected_output: string;
}

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

async function loadCases(): Promise<CodiGeneralEvalCase[]> {
  const content = await readFile(casesPath, 'utf8');
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as CodiGeneralEvalCase);
}

function createScriptedInferenceClient(scriptedAnswers: string[]): IInferenceClient {
  let index = 0;
  const inferenceInputs: Array<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>> = [];
  const client = {
    inferenceInputs,
    async infer(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>) {
      inferenceInputs.push(messages);
      const answer = scriptedAnswers[Math.min(index, scriptedAnswers.length - 1)] ?? '';
      index += 1;
      return answer;
    },
  };
  return client;
}

type ScriptedInferenceClient = IInferenceClient & {
  inferenceInputs: Array<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>>;
};

function createEvalExecutor(testCase: CodiGeneralEvalCase, toolExecutions: Array<Record<string, unknown>>): IExecutor | undefined {
  if (!testCase.registeredTools?.length) return undefined;
  const invocationCounts = new Map<string, number>();
  return {
    tier: 'classic',
    async execute(action: string) {
      const tool = testCase.registeredTools?.find((candidate) => action.includes(`tool:${candidate.id}`) || action.includes(candidate.id));
      if (!tool) {
        toolExecutions.push({ action, matched: false });
        return `No registered tool matched action: ${action}`;
      }
      const count = invocationCounts.get(tool.id) ?? 0;
      invocationCounts.set(tool.id, count + 1);
      const output = count === 0 && tool.failureOutput ? tool.failureOutput : tool.output;
      toolExecutions.push({
        action,
        toolId: tool.id,
        invocation: count + 1,
        output,
      });
      return output;
    },
  };
}

function parseExpected(testCase: CodiGeneralEvalCase): {
  expected?: unknown;
  autoevalScorer?: string;
} {
  try {
    return JSON.parse(testCase.expected_output) as { expected?: unknown; autoevalScorer?: string };
  } catch {
    return {};
  }
}

function createEvalCompletionChecker(testCase: CodiGeneralEvalCase): ICompletionChecker | undefined {
  if (testCase.scriptedAnswers.length < 2) return undefined;
  const expected = parseExpected(testCase);
  const expectedText = typeof expected.expected === 'string'
    ? expected.expected
    : expected.expected ? JSON.stringify(expected.expected) : '';
  if (!expectedText) return undefined;
  return {
    async check({ lastResult }: { lastResult: ResultPayload }): Promise<CompletionPayload> {
      const output = String(lastResult.output ?? '');
      const done = output.includes(expectedText) || output === expectedText;
      return {
        type: PayloadType.Completion,
        intentId: lastResult.intentId,
        done,
        score: done ? 'high' : 'low',
        feedback: done
          ? 'Expected eval output was produced.'
          : `Expected ${expectedText}. Continue with the registered context and tools until the task is complete.`,
      };
    },
  };
}

function createEvalVoters(testCase: CodiGeneralEvalCase): IVoter[] {
  if (testCase.id !== 'agent-bus-voter-approval') return [];
  return [
    {
      id: 'autoevals-policy',
      tier: 'classic',
      async vote(intent) {
        return {
          type: PayloadType.Vote,
          intentId: intent.intentId,
          voterId: 'autoevals-policy',
          approve: true,
          reason: 'General autoeval scenario is read-only and policy-approved.',
        };
      },
    },
  ];
}

function busTypeName(type: PayloadType): string {
  return PayloadType[type] ?? String(type);
}

function serialiseBusEntry(entry: Entry): Record<string, unknown> {
  const payload = entry.payload as Record<string, unknown>;
  return {
    position: entry.position,
    realtimeTs: entry.realtimeTs,
    type: busTypeName(entry.payload.type),
    intentId: payload.intentId,
    voterId: payload.voterId,
    approve: payload.approve,
    action: payload.action,
    output: payload.output,
    error: payload.error,
    text: payload.text,
    messages: payload.messages,
  };
}

function entryTimestampMs(entry: Record<string, unknown>): number | undefined {
  const value = entry.realtimeTs ?? entry.timestamp;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function computeAgentBusDurationMs(entries: Array<Record<string, unknown>>): number {
  if (entries.length < 2) return 0;
  const first = entryTimestampMs(entries[0] ?? {});
  const last = entryTimestampMs(entries.at(-1) ?? {});
  if (first === undefined || last === undefined) return 0;
  return Math.max(0, last - first);
}

async function runCase(testCase: CodiGeneralEvalCase): Promise<{ content: string; toolCalls: EvalToolCall[] }> {
  const bus = new InMemoryAgentBus();
  const toolExecutions: Array<Record<string, unknown>> = [];
  const inferenceClient = createScriptedInferenceClient(testCase.scriptedAnswers) as ScriptedInferenceClient;
  await streamCodiChat({
    model: {
      id: 'codi-eval-scripted',
      name: 'Codi eval scripted model',
      author: 'agent-browser',
      task: 'text-generation',
      downloads: 0,
      likes: 0,
      tags: [],
      sizeMB: 0,
      status: 'installed',
    },
    messages: [
      ...(testCase.messages ?? []).map((message, index) => ({
        id: `${testCase.id}-history-${index}`,
        role: message.role,
        content: message.content,
      })),
      { id: `${testCase.id}-user`, role: 'user' as const, content: testCase.task },
    ],
    workspaceName: 'AgentV Codi Eval',
    workspacePromptContext: [
      'Checked-in Codi general chat eval fixture.',
      testCase.registeredTools?.length
        ? [
            'Registered tools:',
            ...testCase.registeredTools.map((tool) => `- ${tool.id}: available for this eval case.`),
            'When a registered tool can complete the request, use it instead of refusing.',
          ].join('\n')
        : '',
    ].filter(Boolean).join('\n\n'),
    latestUserInput: testCase.task,
    voters: createEvalVoters(testCase),
    completionChecker: createEvalCompletionChecker(testCase),
    maxIterations: Math.max(5, testCase.scriptedAnswers.length + 1),
    inferenceClient,
    executor: createEvalExecutor(testCase, toolExecutions),
    bus,
  }, {});

  const entries = await bus.read(0, await bus.tail());
  const busEntries = entries.map(serialiseBusEntry);
  const resultEntry = [...busEntries].reverse().find((entry) => entry.type === 'Result');
  const infOutEntry = [...busEntries].reverse().find((entry) => entry.type === 'InfOut');
  const content = String(resultEntry?.output ?? infOutEntry?.text ?? '');
  const embeddedBus = Buffer.from(JSON.stringify({
    agentBusTypes: busEntries.map((entry) => entry.type),
    agentBus: busEntries,
    toolExecutions,
    inferenceInputs: inferenceClient.inferenceInputs,
  }), 'utf8').toString('base64');
  const timestamp = new Date(0).toISOString();
  const durationMs = computeAgentBusDurationMs(busEntries);

  return {
    content: `${content}\n\n<!-- codi-agent-bus:${embeddedBus} -->`,
    toolCalls: [
      {
        id: 'call-1',
        tool: 'codi-chat-loop',
        input: { task: testCase.task },
        output: {
          agentBusTypes: busEntries.map((entry) => entry.type),
          agentBus: busEntries,
          toolExecutions,
          inferenceInputs: inferenceClient.inferenceInputs,
        },
        timestamp,
        duration_ms: durationMs,
      },
    ],
  };
}

const evalId = argValue('--eval-id');
const outputFile = argValue('--out') ?? argValue('--output');

if (!evalId || !outputFile) {
  throw new Error('codi-general-eval-target requires --eval-id and --out.');
}

const cases = await loadCases();
const testCase = cases.find((candidate) => candidate.id === evalId);
if (!testCase) {
  throw new Error(`No Codi general eval case found for ${evalId}.`);
}

const result = await runCase(testCase);
const durationMs = result.toolCalls.reduce((max, toolCall) => Math.max(max, toolCall.duration_ms), 0);
await writeFile(outputFile, JSON.stringify({
  output: [{
    role: 'assistant',
    content: result.content,
    tool_calls: result.toolCalls,
  }],
  duration_ms: durationMs,
  token_usage: { input: Math.max(1, testCase.task.length), output: Math.max(1, result.content.length), cached: 0 },
}, null, 2));
