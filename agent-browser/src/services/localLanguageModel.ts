/**
 * services/localLanguageModel.ts
 *
 * Implements LanguageModelV3 wrapping the in-browser HuggingFace ONNX inference
 * engine (browserInferenceEngine). Works with any Transformers.js-compatible model.
 *
 * Tool calling uses ReAct-style prompting since ONNX models do not natively
 * support OpenAI-style function calling schemas.
 */

import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3FinishReason,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamResult,
  LanguageModelV3StreamPart,
  LanguageModelV3FunctionTool,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';
import { browserInferenceEngine } from './browserInference';
import { buildReActToolsSection, parseToolCall } from './reactToolCalling';

const EMPTY_USAGE: LanguageModelV3Usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};

const STOP_FINISH: LanguageModelV3FinishReason = { unified: 'stop', raw: 'stop' };
const TOOL_CALL_FINISH: LanguageModelV3FinishReason = { unified: 'tool-calls', raw: 'tool-calls' };

function buildPromptString(options: LanguageModelV3CallOptions): unknown {
  // HF pipelines accept messages array for chat or string for completion
  const messages: Array<{ role: string; content: string }> = [];
  const functionTools = (options.tools ?? []).filter(
    (tool): tool is LanguageModelV3FunctionTool => tool.type === 'function',
  );

  for (const message of options.prompt) {
    if (message.role === 'system') {
      let content = typeof message.content === 'string' ? message.content : '';
      if (functionTools.length > 0) {
        content += `\n\n${buildReActToolsSection(functionTools)}`;
      }
      messages.push({
        role: 'system',
        content,
      });
    } else {
      const text = message.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('');
      messages.push({ role: message.role === 'user' ? 'user' : 'assistant', content: text });
    }
  }

  return messages;
}

export class LocalLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'local';
  readonly modelId: string;
  readonly supportedUrls = {};
  private readonly task: string;

  constructor(modelId: string, task = 'text-generation') {
    this.modelId = modelId;
    this.task = task;
  }

  async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
    const prompt = buildPromptString(options);
    let text = '';
    let finishReason: LanguageModelV3FinishReason = STOP_FINISH;

    await new Promise<void>((resolve, reject) => {
      browserInferenceEngine
        .generate(
          { task: this.task, modelId: this.modelId, prompt },
          {
            onToken: (token) => { text += token; },
            onDone: () => resolve(),
            onError: reject,
          },
          options.abortSignal,
        )
        .then(resolve)
        .catch(reject);
    });

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
    const prompt = buildPromptString(options);
    const task = this.task;
    const modelId = this.modelId;
    const signal = options.abortSignal;

    const stream = new ReadableStream<LanguageModelV3StreamPart>({
      start(controller) {
        const textId = 'text-0';
        controller.enqueue({ type: 'stream-start', warnings: [] });
        controller.enqueue({ type: 'text-start', id: textId });

        browserInferenceEngine
          .generate(
            { task, modelId, prompt },
            {
              onToken: (token) => {
                controller.enqueue({ type: 'text-delta', id: textId, delta: token });
              },
              onDone: () => {
                controller.enqueue({ type: 'text-end', id: textId });
                controller.enqueue({
                  type: 'finish',
                  finishReason: STOP_FINISH,
                  usage: EMPTY_USAGE,
                });
                controller.close();
              },
              onError: (err) => {
                controller.enqueue({ type: 'error', error: err });
                controller.close();
              },
            },
            signal,
          )
          .catch((err: Error) => {
            controller.enqueue({ type: 'error', error: err });
            controller.close();
          });
      },
    });

    return { stream };
  }
}
