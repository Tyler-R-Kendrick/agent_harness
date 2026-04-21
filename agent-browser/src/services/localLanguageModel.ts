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
import { shouldDisableThinking, trimTextForLocalInference } from './browserInferenceRuntime';
import { buildReActToolsSection, parseToolCall } from './reactToolCalling';

const EMPTY_USAGE: LanguageModelV3Usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};

const STOP_FINISH: LanguageModelV3FinishReason = { unified: 'stop', raw: 'stop' };
const TOOL_CALL_FINISH: LanguageModelV3FinishReason = { unified: 'tool-calls', raw: 'tool-calls' };
const MAX_LOCAL_SYSTEM_MESSAGE_CHARS = 4_000;
const MAX_LOCAL_TURN_MESSAGE_CHARS = 2_500;

type LocalLanguageModelOptions = {
  onPhase?: (phase: string) => void;
  onToken?: (token: string) => void;
};

function buildGenerationOptions(
  options: LanguageModelV3CallOptions,
  modelId: string,
): Record<string, number | boolean> | undefined {
  const generationOptions: Record<string, number | boolean> = {};

  if (typeof options.maxOutputTokens === 'number') {
    generationOptions.max_new_tokens = options.maxOutputTokens;
  }

  if (typeof options.temperature === 'number') {
    generationOptions.temperature = options.temperature;
  }

  if (typeof options.topP === 'number') {
    generationOptions.top_p = options.topP;
  }

  const localProviderOptions = options.providerOptions?.local as
    | Record<string, unknown>
    | undefined;

  if (localProviderOptions) {
    const { enableThinking, topK, minP } = localProviderOptions;
    if (typeof enableThinking === 'boolean') {
      generationOptions.enable_thinking = enableThinking;
    }
    if (typeof topK === 'number') {
      generationOptions.top_k = topK;
    }
    if (typeof minP === 'number') {
      generationOptions.min_p = minP;
    }
  }

  // Auto-disable thinking for known thinking models during planning stages
  // unless the caller explicitly re-enabled it via providerOptions.local.enableThinking.
  if (
    generationOptions.enable_thinking === undefined
    && shouldDisableThinking(modelId)
  ) {
    generationOptions.enable_thinking = false;
  }

  if (Object.keys(generationOptions).length === 0) {
    return undefined;
  }

  if (typeof generationOptions.temperature === 'number' && generationOptions.temperature <= 0.1) {
    generationOptions.do_sample = false;
  }

  return generationOptions;
}

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
        content: trimTextForLocalInference(content, MAX_LOCAL_SYSTEM_MESSAGE_CHARS),
      });
    } else {
      const text = message.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('');
      messages.push({
        role: message.role === 'user' ? 'user' : 'assistant',
        content: trimTextForLocalInference(text, MAX_LOCAL_TURN_MESSAGE_CHARS),
      });
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
  private readonly onPhase?: (phase: string) => void;
  private readonly onToken?: (token: string) => void;

  constructor(modelId: string, task = 'text-generation', options: LocalLanguageModelOptions = {}) {
    this.modelId = modelId;
    this.task = task;
    this.onPhase = options.onPhase;
    this.onToken = options.onToken;
  }

  async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
    const prompt = buildPromptString(options);
    const generationOptions = buildGenerationOptions(options, this.modelId);
    let text = '';
    let finishReason: LanguageModelV3FinishReason = STOP_FINISH;

    await new Promise<void>((resolve, reject) => {
      browserInferenceEngine
        .generate(
          { task: this.task, modelId: this.modelId, prompt, options: generationOptions },
          {
            onPhase: this.onPhase,
            onToken: (token) => {
              text += token;
              this.onToken?.(token);
            },
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
    const generationOptions = buildGenerationOptions(options, this.modelId);
    const task = this.task;
    const modelId = this.modelId;
    const signal = options.abortSignal;
    const onPhase = this.onPhase;

    const stream = new ReadableStream<LanguageModelV3StreamPart>({
      start(controller) {
        const textId = 'text-0';
        controller.enqueue({ type: 'stream-start', warnings: [] });
        controller.enqueue({ type: 'text-start', id: textId });

        browserInferenceEngine
          .generate(
            { task, modelId, prompt, options: generationOptions },
            {
              onPhase,
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
