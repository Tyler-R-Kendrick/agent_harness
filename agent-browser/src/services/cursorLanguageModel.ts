import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3FinishReason,
  LanguageModelV3FunctionTool,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
  LanguageModelV3ToolResultOutput,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';
import { buildReActToolsSection, parseToolCall } from './reactToolCalling';
import { streamCursorChat } from './cursorApi';

const EMPTY_USAGE: LanguageModelV3Usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};

const STOP_FINISH: LanguageModelV3FinishReason = { unified: 'stop', raw: 'stop' };
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

function extractPromptText(options: LanguageModelV3CallOptions): string {
  const parts: string[] = [];
  const functionTools = (options.tools ?? []).filter(
    (tool): tool is LanguageModelV3FunctionTool => tool.type === 'function',
  );

  for (const message of options.prompt) {
    if (message.role === 'system') {
      let system = typeof message.content === 'string' ? message.content : '';
      if (functionTools.length > 0) {
        system += '\n\n' + buildReActToolsSection(functionTools);
      }
      if (system) parts.push(`[system]\n${system}`);
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

export class CursorLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'cursor';
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
    await streamCursorChat({
      modelId: this.modelId,
      sessionId: this.sessionId,
      prompt,
    }, {
      onToken: (delta) => {
        text += delta;
      },
      onDone: (finalContent) => {
        text = finalContent ?? text;
      },
    }, options.abortSignal);

    const toolCall = parseToolCall(text);
    if (toolCall) {
      return {
        content: [
          {
            type: 'tool-call' as const,
            toolCallId: `cursor-tc-${Date.now()}`,
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
      finishReason: STOP_FINISH,
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
          await streamCursorChat({
            modelId,
            sessionId,
            prompt,
          }, {
            onToken: (delta) => {
              controller.enqueue({ type: 'text-delta', id: textId, delta });
            },
            onReasoning: (delta) => {
              controller.enqueue({ type: 'raw', rawValue: { reasoning: delta } });
            },
          }, signal);

          controller.enqueue({ type: 'text-end', id: textId });
          controller.enqueue({
            type: 'finish',
            finishReason: STOP_FINISH,
            usage: EMPTY_USAGE,
          });
        } catch (error) {
          controller.enqueue({ type: 'error', error });
        } finally {
          controller.close();
        }
      },
    });

    return { stream };
  }
}
