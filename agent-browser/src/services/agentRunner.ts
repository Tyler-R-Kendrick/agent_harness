/**
 * services/agentRunner.ts
 *
 * Unified tool-loop executor for all agents.
 *
 * Uses the AI SDK's `generateText` with `maxSteps` to run a full agentic
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

import { generateText, type LanguageModel, type ToolSet } from 'ai';
import type { ModelMessage } from '@ai-sdk/provider-utils';

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
  /** Called whenever the LLM calls a tool, before execution. */
  onToolCall?: (toolName: string, args: unknown) => void;
};

export type AgentRunResult = {
  text: string;
  steps: number;
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
      maxSteps,
      abortSignal: signal,
      onStepFinish: (step) => {
        if (step.toolCalls?.length) {
          for (const call of step.toolCalls) {
            callbacks.onToolCall?.(call.toolName, call.input);
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
