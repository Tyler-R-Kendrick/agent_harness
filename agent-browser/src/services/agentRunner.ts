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
import type { SearchTurnContext } from '../types';

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
  const { model, tools, instructions, messages, maxSteps = 20, signal } = options;

  try {
    const result = await generateText({
      model,
      tools,
      system: instructions,
      messages,
      stopWhen: stepCountIs(maxSteps),
      abortSignal: signal,
      onStepFinish: (step) => {
        if (step.toolCalls?.length) {
          for (const call of step.toolCalls) {
            callbacks.onToolCall?.(call.toolName, call.input, 'toolCallId' in call ? call.toolCallId : undefined);
          }
        }

        if (step.toolResults?.length) {
          for (const result of step.toolResults) {
            const toolCallId = 'toolCallId' in result ? result.toolCallId : undefined;
            const toolName = 'toolName' in result ? result.toolName : 'unknown-tool';
            const args = 'input' in result ? result.input : undefined;
            const resultRecord = result as { output?: unknown; result?: unknown };
            const output = 'output' in result
              ? resultRecord.output
              : resultRecord.result;
            const isError = 'isError' in result ? Boolean(result.isError) : false;
            callbacks.onToolResult?.(toolName, args, output, isError, toolCallId);
          }
        }
      },
    });

    const text = result.text ?? '';
    callbacks.onToken?.(text);
    callbacks.onDone?.(text);

    return { text, steps: result.steps?.length ?? 1 };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    callbacks.onError?.(error);
    throw error;
  }
}
