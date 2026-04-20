/**
 * services/copilotLanguageModel.ts
 *
 * Implements LanguageModelV3 wrapping the /api/copilot/chat proxy endpoint.
 *
 * Tool calling strategy:
 *  - Cloud gateway models (anthropic, openai, etc.) natively support function
 *    calling and are preferred for tool-use agents.
 *  - This adapter supports tool calling via ReAct-style prompting: tool schemas
 *    are injected into the system prompt and <tool_call> blocks are parsed from
 *    the model's text output.  The AI SDK handles tool execution + looping.
 */

import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3FinishReason,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamResult,
  LanguageModelV3StreamPart,
  LanguageModelV3FunctionTool,
  LanguageModelV3ToolResultOutput,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';
import { buildReActToolsSection, parseToolCall } from './reactToolCalling';

const EMPTY_USAGE: LanguageModelV3Usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};

const STOP_FINISH: LanguageModelV3FinishReason = { unified: 'stop', raw: 'stop' };
const OTHER_FINISH: LanguageModelV3FinishReason = { unified: 'other', raw: 'aborted' };
const TOOL_CALL_FINISH: LanguageModelV3FinishReason = { unified: 'tool-calls', raw: 'tool-calls' };

function stringifyToolOutput(output: LanguageModelV3ToolResultOutput): string {
  switch (output.type) {
    case 'text':
    case 'error-text':
      return output.value;
    case 'json':
    case 'error-json':
      return JSON.stringify(output.value);
    case 'execution-denied':
      return output.reason ?? 'Execution denied.';
  }

  return JSON.stringify(output);
}

// ── Prompt extraction ─────────────────────────────────────────────────────────

function extractPromptText(options: LanguageModelV3CallOptions): string {
  const parts: string[] = [];

  // Collect function tools from options
  const functionTools = (options.tools ?? []).filter(
    (t): t is LanguageModelV3FunctionTool => t.type === 'function',
  );

  for (const message of options.prompt) {
    if (message.role === 'system') {
      let sys = typeof message.content === 'string' ? message.content : '';
      if (functionTools.length > 0) {
        sys += '\n\n' + buildReActToolsSection(functionTools);
      }
      if (sys) parts.push(`[system]\n${sys}`);
    } else {
      for (const part of message.content) {
        if (part.type === 'text') parts.push(`[${message.role}]\n${part.text}`);
        if (part.type === 'tool-result') {
          const output = stringifyToolOutput(part.output);
          parts.push(`[tool_result name="${part.toolName}"]\n${output}`);
        }
      }
    }
  }

  return parts.join('\n\n');
}

// ── Copilot proxy streaming ───────────────────────────────────────────────────

type CopilotStreamEvent =
  | { type: 'token'; delta: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'reasoning_step'; id?: string; title: string; body?: string }
  | { type: 'tool_call_start'; id?: string; tool: string; args?: Record<string, unknown> }
  | { type: 'tool_call_end'; id?: string }
  | { type: 'search'; id?: string; title?: string; query?: string }
  | { type: 'final'; content: string }
  | { type: 'done'; aborted?: boolean }
  | { type: 'error'; message: string };

async function* streamCopilotProxy(
  modelId: string,
  prompt: string,
  sessionId: string,
  signal?: AbortSignal,
): AsyncGenerator<CopilotStreamEvent> {
  const response = await fetch('/api/copilot/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId, prompt, sessionId }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Copilot request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    let idx = buffer.indexOf('\n');
    while (idx !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line) yield JSON.parse(line) as CopilotStreamEvent;
      idx = buffer.indexOf('\n');
    }

    if (done) break;
  }
}

// ── LanguageModelV3 implementation ────────────────────────────────────────────

export class CopilotLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'copilot';
  readonly modelId: string;
  readonly sessionId: string;
  readonly supportedUrls = {};

  constructor(modelId: string, sessionId: string) {
    this.modelId = modelId;
    this.sessionId = sessionId;
  }

  async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
    const prompt = extractPromptText(options);
    let text = '';
    let finishReason: LanguageModelV3FinishReason = STOP_FINISH;

    for await (const event of streamCopilotProxy(this.modelId, prompt, this.sessionId, options.abortSignal)) {
      if (event.type === 'token') text += event.delta;
      if (event.type === 'final') text = event.content;
      if (event.type === 'error') throw new Error(event.message);
      if (event.type === 'done' && event.aborted) finishReason = OTHER_FINISH;
    }

    // Parse ReAct tool call from text output
    const toolCall = parseToolCall(text);
    if (toolCall) {
      return {
        content: [
          {
            type: 'tool-call' as const,
            toolCallId: `tc-${Date.now()}`,
            toolName: toolCall.toolName,
            input: JSON.stringify(toolCall.args),
          },
        ],
        usage: EMPTY_USAGE,
        finishReason: TOOL_CALL_FINISH,
        warnings: [],
      };
    }

    return {
      content: [{ type: 'text' as const, text }],
      usage: EMPTY_USAGE,
      finishReason,
      warnings: [],
    };
  }

  async doStream(options: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
    const prompt = extractPromptText(options);
    const modelId = this.modelId;
    const sessionId = this.sessionId;
    const signal = options.abortSignal;

    const stream = new ReadableStream<LanguageModelV3StreamPart>({
      async start(controller) {
        const textId = 'text-0';
        controller.enqueue({ type: 'stream-start', warnings: [] });
        controller.enqueue({ type: 'text-start', id: textId });

        try {
          let fullText = '';
          for await (const event of streamCopilotProxy(modelId, prompt, sessionId, signal)) {
            if (event.type === 'token') {
              controller.enqueue({ type: 'text-delta', id: textId, delta: event.delta });
              fullText += event.delta;
            }
            if (event.type === 'reasoning') {
              controller.enqueue({ type: 'raw', rawValue: { reasoning: event.delta } });
            }
            if (event.type === 'reasoning_step') {
              controller.enqueue({ type: 'raw', rawValue: { reasoningStep: event } });
            }
            if (event.type === 'search') {
              controller.enqueue({ type: 'raw', rawValue: { search: event } });
            }
            if (event.type === 'final') fullText = event.content;
            if (event.type === 'error') throw new Error(event.message);
          }

          controller.enqueue({ type: 'text-end', id: textId });
          controller.enqueue({
            type: 'finish',
            finishReason: STOP_FINISH,
            usage: EMPTY_USAGE,
          });
        } catch (err) {
          controller.enqueue({ type: 'error', error: err });
        } finally {
          controller.close();
        }
      },
    });

    return { stream };
  }
}

