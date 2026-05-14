/**
 * services/agentRunner.ts
 *
 * Unified tool-loop executor for all agents.
 *
 * Uses the AI SDK's `generateText` with `stopWhen` to run a full agentic
 * tool loop — the LLM calls tools, gets results, and continues until it
 * produces a final text response.
 *
 * Supports:
 *  - All AI SDK LanguageModel providers (gateway, copilot, local)
 *  - Any AI SDK `tool()` definitions (inbrowser-use, MCP-bridged, custom)
 *  - AbortSignal for cancellation
 *  - Streaming callbacks for UI integration
 *
 * MCP integration: pass external MCP tools via the `tools` property.
 * A2A routing: the caller composes multiple agent runs (runToolAgent chains).
 */

import { generateText, stepCountIs, type LanguageModel, type ToolSet } from 'ai';
import type { ModelMessage } from '@ai-sdk/provider-utils';
import { SpanKind } from '@opentelemetry/api';
import type { Attributes } from '@opentelemetry/api';
import { withHarnessTelemetrySpan } from 'harness-core';
import type { SearchTurnContext } from '../types';
import { getDefaultSecretsManagerAgent, type SecretsManagerAgent } from '../chat-agents/Secrets';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentRunOptions = {
  /** The AI SDK LanguageModel to use (gateway, copilot, or local). */
  model: LanguageModel;
  /** AI SDK tool() definitions to expose to the LLM. */
  tools: ToolSet;
  /** System prompt / instructions. */
  instructions: string;
  /** Conversation history. */
  messages: ModelMessage[];
  /** Maximum number of tool-loop steps before stopping. Default: 20. */
  maxSteps?: number;
  /** Optional abort signal for cancellation. */
  signal?: AbortSignal;
  /** Local secret guard used to keep model prompts on refs and resolve refs only inside tool execution. */
  secrets?: SecretsManagerAgent;
};

export type AgentRunCallbacks = {
  /** Called with each token as it arrives (post-tool-use text). */
  onToken?: (delta: string) => void;
  /** Called with the final complete text when the run finishes. */
  onDone?: (text: string) => void;
  /** Called if the run throws an error. */
  onError?: (error: Error) => void;
  /** Called whenever the runner observes a tool call in a completed step. */
  onToolCall?: (toolName: string, args: unknown, toolCallId?: string) => void;
  /** Called whenever the runner observes the result for a tool call. */
  onToolResult?: (toolName: string, args: unknown, result: unknown, isError: boolean, toolCallId?: string) => void;
};

export type AgentRunResult = {
  text: string;
  steps: number;
  failed?: boolean;
  error?: string;
  blocked?: boolean;
  needsUserInput?: boolean;
  elicitation?: unknown;
  searchTurnContext?: SearchTurnContext;
};

const EMPTY_FINAL_AFTER_TOOL_USE_ERROR = 'Model stopped before producing a final answer after tool use.';
const EMPTY_FINAL_ERROR = 'Model stopped before producing a final answer.';

function buildEmptyFinalResponse(hadToolActivity: boolean): { text: string; error: string } {
  return hadToolActivity
    ? {
      text: 'I ran the requested tools, but the model stopped before producing a final answer. Please retry or narrow the request.',
      error: EMPTY_FINAL_AFTER_TOOL_USE_ERROR,
    }
    : {
      text: 'The model stopped before producing a final answer. Please retry the request.',
      error: EMPTY_FINAL_ERROR,
    };
}

// ── Runner ────────────────────────────────────────────────────────────────────

/**
 * Runs a full agentic tool loop and returns the final text.
 *
 * @example
 * ```ts
 * const result = await runToolAgent(
 *   { model, tools: createInBrowserUseTools(page), instructions, messages },
 *   { onToken: (d) => console.log(d), onDone: (t) => console.log('done', t) },
 * );
 * ```
 */
export async function runToolAgent(
  options: AgentRunOptions,
  callbacks: AgentRunCallbacks,
): Promise<AgentRunResult> {
  const { model, maxSteps = 20, signal } = options;
  const secrets = options.secrets ?? getDefaultSecretsManagerAgent();
  const instructions = (await secrets.sanitizeText(options.instructions)).text;
  const messages = await secrets.sanitizeModelMessages(options.messages);
  const tools = secrets.wrapTools(options.tools);
  let observedSteps = 0;
  let hadToolActivity = false;

  try {
    const result = await withHarnessTelemetrySpan('harness.llm.generate_text', {
      kind: SpanKind.CLIENT,
      attributes: {
        'gen_ai.operation.name': 'generateText',
        ...modelTelemetryAttributes(model),
        'llm.input.messages.count': messages.length,
        'llm.input.characters': sumModelMessageContentCharacters(messages),
        'llm.system.characters': instructions.length,
        'agent.max_steps': maxSteps,
        'agent.tools.count': Object.keys(tools).length,
      },
    }, async (span) => {
      const generated = await generateText({
        model,
        tools,
        system: instructions,
        messages,
        stopWhen: stepCountIs(maxSteps),
        abortSignal: signal,
        onStepFinish: (step) => {
          observedSteps += 1;
          if (step.toolCalls?.length) {
            hadToolActivity = true;
            for (const call of step.toolCalls) {
              const toolCallId = 'toolCallId' in call ? call.toolCallId : undefined;
              span.addEvent('harness.llm.tool_call', toolTelemetryAttributes(call.toolName, toolCallId));
              callbacks.onToolCall?.(call.toolName, call.input, toolCallId);
            }
          }

          if (step.toolResults?.length) {
            hadToolActivity = true;
            for (const result of step.toolResults) {
              const toolCallId = 'toolCallId' in result ? result.toolCallId : undefined;
              const toolName = 'toolName' in result ? result.toolName : 'unknown-tool';
              const args = 'input' in result ? result.input : undefined;
              const resultRecord = result as { output?: unknown; result?: unknown };
              const output = 'output' in result
                ? resultRecord.output
                : resultRecord.result;
              const isError = 'isError' in result ? Boolean(result.isError) : false;
              span.addEvent('harness.llm.tool_result', {
                ...toolTelemetryAttributes(toolName, toolCallId),
                'tool.result.error': isError,
              });
              callbacks.onToolResult?.(toolName, args, output, isError, toolCallId);
            }
          }
        },
      });
      span.setAttributes({
        ...usageTelemetryAttributes(generated.usage),
        'agent.steps': generated.steps?.length ?? Math.max(observedSteps, 1),
        'llm.output.characters': (generated.text ?? '').length,
      });
      return generated;
    });

    const rawText = result.text ?? '';
    const emptyFinal = rawText.trim().length === 0;
    const finalResponse = emptyFinal ? buildEmptyFinalResponse(hadToolActivity) : null;
    const text = finalResponse?.text ?? rawText;
    callbacks.onToken?.(text);
    callbacks.onDone?.(text);

    return {
      text,
      steps: result.steps?.length ?? Math.max(observedSteps, 1),
      ...(finalResponse ? { failed: true, error: finalResponse.error } : {}),
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    callbacks.onError?.(error);
    throw error;
  }
}

function modelTelemetryAttributes(model: LanguageModel): Attributes {
  const modelRef = model as { provider?: unknown; modelId?: unknown };
  return {
    ...(typeof modelRef.provider === 'string' ? { 'gen_ai.provider.name': modelRef.provider } : {}),
    ...(typeof modelRef.modelId === 'string' ? { 'gen_ai.request.model': modelRef.modelId } : {}),
  };
}

function usageTelemetryAttributes(usage: unknown): Attributes {
  const usageRecord = usage as {
    promptTokens?: unknown;
    completionTokens?: unknown;
    totalTokens?: unknown;
    inputTokens?: { total?: unknown };
    outputTokens?: { total?: unknown };
  } | undefined;
  const promptTokens = numberAttribute(usageRecord?.promptTokens)
    ?? numberAttribute(usageRecord?.inputTokens?.total);
  const completionTokens = numberAttribute(usageRecord?.completionTokens)
    ?? numberAttribute(usageRecord?.outputTokens?.total);
  const totalTokens = numberAttribute(usageRecord?.totalTokens)
    ?? (promptTokens !== undefined && completionTokens !== undefined ? promptTokens + completionTokens : undefined);

  return {
    ...(promptTokens !== undefined ? { 'llm.usage.prompt_tokens': promptTokens } : {}),
    ...(completionTokens !== undefined ? { 'llm.usage.completion_tokens': completionTokens } : {}),
    ...(totalTokens !== undefined ? { 'llm.usage.total_tokens': totalTokens } : {}),
  };
}

function numberAttribute(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toolTelemetryAttributes(toolName: string, toolCallId: string | undefined): Attributes {
  return {
    'tool.name': toolName,
    ...(toolCallId !== undefined ? { 'tool.call.id': toolCallId } : {}),
  };
}

function sumModelMessageContentCharacters(messages: readonly ModelMessage[]): number {
  return messages.reduce((total, message) => total + modelMessageContentCharacters(message), 0);
}

function modelMessageContentCharacters(message: ModelMessage): number {
  const content = (message as { content?: unknown }).content;
  if (typeof content === 'string') {
    return content.length;
  }
  if (!Array.isArray(content)) {
    return 0;
  }
  return content.reduce((total, part) => {
    const text = typeof part === 'object'
      && part !== null
      && 'text' in part
      && typeof (part as { text?: unknown }).text === 'string'
      ? (part as { text: string }).text
      : '';
    return total + text.length;
  }, 0);
}
