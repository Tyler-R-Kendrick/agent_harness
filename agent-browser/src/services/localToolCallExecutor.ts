/**
 * services/localToolCallExecutor.ts
 *
 * ReAct-style JSON tool-call executor for local language models that do not
 * speak the AI-SDK native tool-call protocol (e.g. Qwen3-ONNX via
 * `LocalLanguageModel`).
 *
 * Each turn:
 *   1. The model is streamed with the system prompt + conversation history +
 *      tool catalog. The catalog tells the model to emit:
 *         <tool_call>{"tool":"<name>","args":{...}}</tool_call>
 *      to call a tool, or to answer directly otherwise.
 *   2. The streamed text is parsed via `parseToolCall`. If a tool call is
 *      present, the matching tool from the supplied `ToolSet` is executed
 *      and the result is appended to the conversation as a tool message; the
 *      loop runs another turn. Otherwise the streamed text is the final
 *      answer.
 *
 * The executor is wrapped in `runAgentLoop` so the entire run flows through
 * LogAct's Driver → Voter(s) → Decider → Executor pipeline. Voters and a
 * completion checker can be supplied to drive ReAct retries on rejection.
 */

import type { LanguageModel, ToolSet } from 'ai';
import type { ModelMessage } from '@ai-sdk/provider-utils';
import type { LanguageModelV3GenerateResult, LanguageModelV3StreamPart } from '@ai-sdk/provider';
import type { ICompletionChecker, IVoter } from 'logact';
import { runAgentLoop } from '../chat-agents/agent-loop';
import type { AgentRunCallbacks, AgentRunResult } from './agentRunner';
import type { AgentStreamCallbacks } from '../chat-agents/types';
import { buildReActToolsSection } from './reactToolCalling';
import type { ToolDescriptor } from '../tools';
import { createObservedBus } from './observedAgentBus';
import type { BusEntryStep } from '../types';

export type LocalToolCallExecutorOptions = {
  model: LanguageModel;
  tools: ToolSet;
  toolDescriptors: ToolDescriptor[];
  instructions: string;
  messages: ModelMessage[];
  signal?: AbortSignal;
  maxSteps?: number;
  voters?: IVoter[];
  completionChecker?: ICompletionChecker;
  maxIterations?: number;
  /**
   * When true (the default whenever tools are available) the executor will
   * NOT accept a final-answer turn that contains no tool call. Instead it
   * pushes a synthetic system nudge into the conversation and loops so the
   * model has another chance to call a tool. After `maxToolUseRetries` such
   * retries the executor returns whatever the model said last so the run
   * doesn't hang forever.
   */
  requireToolUse?: boolean;
  /**
   * Maximum number of consecutive "no tool call yet" retries before giving
   * up. Defaults to 2 so a single failed turn becomes a forced retry.
   */
  maxToolUseRetries?: number;
};

export type LocalToolCallExecutorCallbacks = AgentRunCallbacks
  & Pick<AgentStreamCallbacks,
    'onVoterStep'
    | 'onVoterStepUpdate'
    | 'onVoterStepEnd'
    | 'onIterationStep'
    | 'onIterationStepUpdate'
    | 'onIterationStepEnd'
  >
  & {
    /**
     * Fired when an inference turn (one model generation pass) starts.
     * Use to surface "executor is generating" rows in the Process timeline
     * so the user can see the model is actually working between tool calls.
     */
    onModelTurnStart?: (turnId: string, stepIndex: number) => void;
    /**
     * Fired when a turn completes. `parsedToolCall` is non-null when the
     * turn produced a `<tool_call>` JSON block.
     */
    onModelTurnEnd?: (
      turnId: string,
      text: string,
      parsedToolCall: { toolName: string; args: Record<string, unknown> } | null,
    ) => void;
    /**
     * Fired for every entry appended to the underlying observed AgentBus.
     * When set, `runLocalToolCallExecutor` constructs an observed bus and
     * threads it through `runAgentLoop` so all LogAct payloads (Mail, InfIn,
     * InfOut, Intent, Vote, Commit, Result, …) are captured.
     */
    onBusEntry?: (entry: BusEntryStep) => void;
  };

type StreamableModel = {
  doGenerate?: (options: unknown) => Promise<LanguageModelV3GenerateResult>;
  doStream?: (options: unknown) => Promise<{ stream: ReadableStream<LanguageModelV3StreamPart> }>;
};

const DEFAULT_MAX_STEPS = 6;

const TOOL_CALL_BLOCK_RE = /<tool_call>([\s\S]*?)<\/tool_call>/i;
const FENCED_JSON_RE = /```(?:json)?\s*([\s\S]*?)```/i;
const BARE_JSON_RE = /\{[\s\S]*\}/;

export type ParsedLocalToolCall = {
  toolName: string;
  args: Record<string, unknown>;
} | null;

export function parseLocalToolCall(text: string): ParsedLocalToolCall {
  const candidates: string[] = [];
  const block = TOOL_CALL_BLOCK_RE.exec(text);
  if (block) candidates.push(block[1]);
  const fenced = FENCED_JSON_RE.exec(text);
  if (fenced) candidates.push(fenced[1]);
  const bare = BARE_JSON_RE.exec(text);
  if (bare) candidates.push(bare[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.trim()) as { tool?: string; args?: Record<string, unknown> };
      if (parsed && typeof parsed.tool === 'string' && parsed.tool.length > 0) {
        return { toolName: parsed.tool, args: parsed.args ?? {} };
      }
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function buildLocalSystemPrompt(instructions: string, descriptors: ToolDescriptor[]): string {
  const toolsSection = buildReActToolsSection(
    descriptors.map((descriptor) => ({
      type: 'function',
      name: descriptor.id,
      description: descriptor.description,
      inputSchema: { type: 'object', properties: {} },
    })) as never,
  );
  return [instructions, toolsSection].filter(Boolean).join('\n\n');
}

async function streamModelText(
  model: LanguageModel,
  prompt: ModelMessage[],
  signal: AbortSignal | undefined,
  onToken: ((delta: string) => void) | undefined,
): Promise<string> {
  const streamable = model as unknown as StreamableModel;
  const callOptions = { abortSignal: signal, prompt, tools: [] };
  if (typeof streamable.doStream === 'function') {
    const { stream } = await streamable.doStream(callOptions);
    const reader = stream.getReader();
    let text = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value.type === 'text-delta') {
        text += value.delta;
        onToken?.(value.delta);
      } else if (value.type === 'error') {
        throw value.error instanceof Error ? value.error : new Error(String(value.error));
      }
    }
    return text;
  }
  if (typeof streamable.doGenerate === 'function') {
    const result = await streamable.doGenerate(callOptions);
    const text = result.content
      .filter((part): part is Extract<(typeof result.content)[number], { type: 'text' }> => part.type === 'text')
      .map((part) => part.text)
      .join('');
    if (text) onToken?.(text);
    return text;
  }
  throw new Error('Local tool-call executor: model does not support doStream or doGenerate.');
}

function messageToString(message: ModelMessage): string {
  if (typeof message.content === 'string') return message.content;
  return message.content
    .map((part) => (part.type === 'text' ? part.text : `[${part.type}]`))
    .join('\n');
}

async function runOneInferencePass(
  options: LocalToolCallExecutorOptions,
  callbacks: LocalToolCallExecutorCallbacks,
): Promise<AgentRunResult> {
  const { model, tools, toolDescriptors, instructions, messages, signal } = options;
  const maxSteps = Math.max(1, options.maxSteps ?? DEFAULT_MAX_STEPS);
  const hasTools = toolDescriptors.length > 0;
  const requireToolUse = options.requireToolUse ?? hasTools;
  const maxToolUseRetries = Math.max(0, options.maxToolUseRetries ?? 2);
  const systemPrompt = buildLocalSystemPrompt(instructions, toolDescriptors);
  const conversation: ModelMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  let lastText = '';
  let steps = 0;
  let toolCallCounter = 0;
  let toolUseRetries = 0;
  let toolCallsExecuted = 0;
  let turnCounter = 0;

  for (let step = 0; step < maxSteps; step += 1) {
    steps += 1;
    turnCounter += 1;
    const turnId = `local-turn-${turnCounter}`;
    callbacks.onModelTurnStart?.(turnId, step);
    const turnText = await streamModelText(model, conversation, signal, callbacks.onToken);
    lastText = turnText;
    const parsed = parseLocalToolCall(turnText);
    callbacks.onModelTurnEnd?.(turnId, turnText, parsed);
    if (!parsed) {
      // If the model produced a final answer without ever calling a tool but
      // tools are required, push a synthetic system nudge and try again.
      if (
        requireToolUse
        && hasTools
        && toolCallsExecuted === 0
        && toolUseRetries < maxToolUseRetries
      ) {
        toolUseRetries += 1;
        conversation.push({ role: 'assistant', content: [{ type: 'text', text: turnText }] });
        conversation.push({
          role: 'user',
          content: [{
            type: 'text',
            text: 'No tool was called. You MUST emit `<tool_call>{"tool":"<name>","args":{...}}</tool_call>` using one of the available tools to make progress. Do not answer in plain text yet.',
          }],
        });
        continue;
      }
      callbacks.onDone?.(turnText);
      return { text: turnText, steps };
    }

    toolCallCounter += 1;
    toolCallsExecuted += 1;
    const toolCallId = `local-tool-${toolCallCounter}`;
    callbacks.onToolCall?.(parsed.toolName, parsed.args, toolCallId);

    const tool = (tools as Record<string, { execute?: (args: unknown, options?: unknown) => unknown | Promise<unknown> }>)[parsed.toolName];
    let resultPayload: unknown;
    let isError = false;
    if (!tool || typeof tool.execute !== 'function') {
      resultPayload = `Unknown tool "${parsed.toolName}". Available tools: ${toolDescriptors.map((d) => d.id).join(', ') || '(none)'}.`;
      isError = true;
    } else {
      try {
        resultPayload = await tool.execute(parsed.args, { toolCallId, abortSignal: signal, messages: conversation });
      } catch (error) {
        resultPayload = `Tool "${parsed.toolName}" failed: ${error instanceof Error ? error.message : String(error)}`;
        isError = true;
      }
    }
    callbacks.onToolResult?.(parsed.toolName, parsed.args, resultPayload, isError, toolCallId);

    const serialized = typeof resultPayload === 'string' ? resultPayload : safeStringify(resultPayload);
    conversation.push({ role: 'assistant', content: [{ type: 'text', text: turnText }] });
    conversation.push({
      role: 'user',
      content: [{
        type: 'text',
        text: `<tool_result tool="${parsed.toolName}"${isError ? ' error="true"' : ''}>${serialized}</tool_result>`,
      }],
    });
  }

  // Hit step cap mid-loop; surface the last turn text as the result.
  callbacks.onDone?.(lastText);
  return { text: lastText, steps };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Executes a local language model in a JSON tool-call ReAct loop, wrapped in
 * LogAct's `runAgentLoop`. The single inference pass (which may itself loop
 * across many model turns + tool calls) is treated as the LogAct executor's
 * `infer()` call, so voters and the completion checker apply per pass.
 */
export async function runLocalToolCallExecutor(
  options: LocalToolCallExecutorOptions,
  callbacks: LocalToolCallExecutorCallbacks,
): Promise<AgentRunResult> {
  const { messages, voters = [], completionChecker, maxIterations } = options;

  let captured: AgentRunResult = { text: '', steps: 0 };
  let lastError: Error | null = null;
  let feedback: string | null = null;

  // Build an observed bus so every LogAct payload (Mail/InfIn/InfOut/Intent/
  // Vote/Commit/Abort/Result/Completion/Policy) is mirrored to onBusEntry.
  // Without this the Process timeline shows the executor stage but nothing
  // about what's actually happening inside LogAct.
  const bus = createObservedBus(callbacks.onBusEntry);

  await runAgentLoop({
    bus,
    inferenceClient: {
      async infer() {
        const passOptions: LocalToolCallExecutorOptions = feedback
          ? {
            ...options,
            messages: [
              ...messages,
              { role: 'system', content: feedback },
            ],
          }
          : options;
        try {
          captured = await runOneInferencePass(passOptions, callbacks);
          return captured.text;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          throw lastError;
        }
      },
    },
    messages: messages.map((message) => ({ content: messageToString(message) })),
    voters,
    completionChecker: completionChecker
      ? {
        async check(context) {
          const result = await completionChecker.check(context);
          feedback = !result.done && result.feedback?.trim() ? result.feedback.trim() : null;
          return result;
        },
      }
      : undefined,
    maxIterations,
  }, callbacks);

  if (lastError && !captured.text) throw lastError;
  return captured;
}
