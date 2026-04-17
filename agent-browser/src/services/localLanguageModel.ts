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
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamResult,
  LanguageModelV3StreamPart,
  LanguageModelV3FinishReason,
} from '@ai-sdk/provider';
import { browserInferenceEngine } from './browserInference';

function buildPromptString(options: LanguageModelV3CallOptions): unknown {
  // HF pipelines accept messages array for chat or string for completion
  const messages: Array<{ role: string; content: string }> = [];

  for (const message of options.prompt) {
    if (message.role === 'system') {
      messages.push({
        role: 'system',
        content: typeof message.content === 'string' ? message.content : '',
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
  private readonly task: string;

  constructor(modelId: string, task = 'text-generation') {
    this.modelId = modelId;
    this.task = task;
  }

  async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
    const prompt = buildPromptString(options);
    let text = '';
    let finishReason: LanguageModelV3FinishReason = { type: 'stop' };

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

    return {
      content: [{ type: 'text' as const, text }],
      usage: { inputTokens: 0, outputTokens: 0 },
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
                  finishReason: { type: 'stop' },
                  usage: { inputTokens: 0, outputTokens: 0 },
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
