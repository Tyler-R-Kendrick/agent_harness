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
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamResult,
  LanguageModelV3StreamPart,
  LanguageModelV3FinishReason,
  LanguageModelV3FunctionTool,
} from '@ai-sdk/provider';

// ── ReAct tool helpers ────────────────────────────────────────────────────────

function buildReActToolsSection(tools: LanguageModelV3FunctionTool[]): string {
  if (!tools.length) return '';

  const lines = [
    '## Tools',
    '',
    'You have access to the following tools. To call a tool, output EXACTLY:',
    '<tool_call>{"tool": "<name>", "args": {<arguments>}}</tool_call>',
    '',
    'Then stop immediately. Wait for the tool result before continuing.',
    '',
    'Available tools:',
  ];

  for (const t of tools) {
    const params = t.parameters as Record<string, unknown>;
    const props = (params.properties as Record<string, { description?: string; type?: string }>) ?? {};
    const paramList = Object.entries(props)
      .map(([k, v]) => `${k}: ${v.type ?? 'any'}${v.description ? ` (${v.description})` : ''}`)
      .join(', ');
    lines.push(`- ${t.name}(${paramList})${t.description ? `: ${t.description}` : ''}`);
  }

  return lines.join('\n');
}

type ParsedToolCall = { toolName: string; args: Record<string, unknown> } | null;

function parseToolCall(text: string): ParsedToolCall {
  const match = /<tool_call>([\s\S]*?)<\/tool_call>/.exec(text);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as { tool: string; args?: Record<string, unknown> };
    return { toolName: parsed.tool, args: parsed.args ?? {} };
  } catch {
    return null;
  }
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
          const output = Array.isArray(part.content)
            ? part.content
                .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
                .map((c) => c.text)
                .join('')
            : String(part.content ?? '');
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
  | { type: 'final'; content: string }
  | { type: 'done'; aborted?: boolean }
  | { type: 'error'; message: string };

async function* streamCopilotProxy(
  modelId: string,
  prompt: string,
  signal?: AbortSignal,
): AsyncGenerator<CopilotStreamEvent> {
  const response = await fetch('/api/copilot/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId, prompt }),
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

  constructor(modelId: string) {
    this.modelId = modelId;
  }

  async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
    const prompt = extractPromptText(options);
    let text = '';
    let finishReason: LanguageModelV3FinishReason = { type: 'stop' };

    for await (const event of streamCopilotProxy(this.modelId, prompt, options.abortSignal)) {
      if (event.type === 'token') text += event.delta;
      if (event.type === 'final') text = event.content;
      if (event.type === 'error') throw new Error(event.message);
      if (event.type === 'done' && event.aborted) finishReason = { type: 'other' };
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
            input: toolCall.args,
          },
        ],
        usage: { inputTokens: 0, outputTokens: 0 },
        finishReason: { type: 'tool-calls' },
        warnings: [],
      };
    }

    return {
      content: [{ type: 'text' as const, text }],
      usage: { inputTokens: 0, outputTokens: 0 },
      finishReason,
      warnings: [],
    };
  }

  async doStream(options: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
    const prompt = extractPromptText(options);
    const modelId = this.modelId;
    const signal = options.abortSignal;

    const stream = new ReadableStream<LanguageModelV3StreamPart>({
      async start(controller) {
        const textId = 'text-0';
        controller.enqueue({ type: 'stream-start', warnings: [] });
        controller.enqueue({ type: 'text-start', id: textId });

        try {
          let fullText = '';
          for await (const event of streamCopilotProxy(modelId, prompt, signal)) {
            if (event.type === 'token') {
              controller.enqueue({ type: 'text-delta', id: textId, delta: event.delta });
              fullText += event.delta;
            }
            if (event.type === 'reasoning') {
              controller.enqueue({ type: 'raw', rawValue: { reasoning: event.delta } });
            }
            if (event.type === 'final') fullText = event.content;
            if (event.type === 'error') throw new Error(event.message);
          }

          controller.enqueue({ type: 'text-end', id: textId });
          controller.enqueue({
            type: 'finish',
            finishReason: { type: 'stop' },
            usage: { inputTokens: 0, outputTokens: 0 },
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

