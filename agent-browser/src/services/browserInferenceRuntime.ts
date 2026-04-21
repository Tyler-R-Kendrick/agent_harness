import { TextStreamer, type PreTrainedTokenizer } from '@huggingface/transformers';

const PROMPT_TRUNCATION_MARKER = '\n...\n';
const DEFAULT_MAX_PROMPT_CHARS = 12_000;
const MAX_SYSTEM_MESSAGE_CHARS = 3_000;
const MAX_TURN_MESSAGE_CHARS = 2_000;

type ProgressInfo = {
  status?: unknown;
  file?: unknown;
  progress?: unknown;
  loaded?: unknown;
  total?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isChatLikeMessage(value: unknown): value is { role: string; content: string } {
  return isRecord(value) && typeof value.role === 'string' && typeof value.content === 'string';
}

function truncateMiddle(text: string, maxChars: number): string {
  if (maxChars <= 0) return '';
  if (text.length <= maxChars) return text;
  if (maxChars <= PROMPT_TRUNCATION_MARKER.length) return text.slice(0, maxChars);

  const available = maxChars - PROMPT_TRUNCATION_MARKER.length;
  const head = Math.ceil(available / 2);
  const tail = Math.floor(available / 2);

  return `${text.slice(0, head)}${PROMPT_TRUNCATION_MARKER}${text.slice(text.length - tail)}`;
}

function promptSize(prompt: Array<{ role: string; content: string }>): number {
  return prompt.reduce((total, message) => total + message.content.length, 0);
}

function compactChatPrompt(
  prompt: Array<{ role: string; content: string }>,
  maxChars: number,
): Array<{ role: string; content: string }> {
  const systems = prompt
    .filter((message) => message.role === 'system')
    .map((message) => ({ ...message, content: truncateMiddle(message.content, MAX_SYSTEM_MESSAGE_CHARS) }));
  const turns = prompt
    .filter((message) => message.role !== 'system')
    .map((message) => ({ ...message, content: truncateMiddle(message.content, MAX_TURN_MESSAGE_CHARS) }));

  while (promptSize([...systems, ...turns]) > maxChars && turns.length > 1) {
    turns.shift();
  }

  const compacted = [...systems, ...turns];
  let overflow = promptSize(compacted) - maxChars;

  if (overflow <= 0) return compacted;

  return compacted.map((message) => {
    if (overflow <= 0) return message;

    const minChars = message.role === 'system' ? 160 : 96;
    const shrinkable = Math.max(0, message.content.length - minChars);
    if (!shrinkable) return message;

    const nextLength = message.content.length - Math.min(shrinkable, overflow);
    overflow -= message.content.length - nextLength;

    return {
      ...message,
      content: truncateMiddle(message.content, nextLength),
    };
  });
}

export function isStreamingTask(task: string): task is 'text-generation' {
  return task === 'text-generation';
}

export function trimTextForLocalInference(text: string, maxChars: number): string {
  return truncateMiddle(text, maxChars);
}

export function compactPromptForBrowserInference(prompt: unknown, maxChars = DEFAULT_MAX_PROMPT_CHARS): unknown {
  if (typeof prompt === 'string') {
    return truncateMiddle(prompt, maxChars);
  }

  if (Array.isArray(prompt) && prompt.every(isChatLikeMessage)) {
    return compactChatPrompt(prompt, maxChars);
  }

  return prompt;
}

export function normalizeBrowserInferenceErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/OrtRun\(\)|Integer overflow/i.test(message)) {
    return 'Local model input exceeded the browser inference limits. The prompt was reduced automatically, but this model still overflowed. Try a shorter chat request or smaller workspace instructions.';
  }

  return message;
}

function shouldPreferQ4Load(task: string, modelId: string): boolean {
  return task === 'text-generation' && /qwen3-0\.6b-onnx/i.test(modelId);
}

/**
 * Qwen3 models apply `enable_thinking: true` in their chat template by default,
 * which bloats short planning responses with `<think>...</think>` blocks and
 * exhausts tight stage budgets. Staged planning stages auto-disable thinking
 * for known thinking models; direct chat can opt back in via provider options.
 */
export function shouldDisableThinking(modelId: string): boolean {
  return /qwen3/i.test(modelId);
}

export function buildPipelineLoadOptions(task: string, modelId: string, onPhase?: (phase: string) => void) {
  let lastPhase = '';
  let lastProgressFile = '';
  let lastProgressBucket = -1;

  const emitPhase = (phase: string) => {
    if (!onPhase || !phase || phase === lastPhase) return;
    lastPhase = phase;
    onPhase(phase);
  };

  const loadOptions: Record<string, unknown> = {
    progress_callback(progress: ProgressInfo) {
      if (!onPhase) return;

      const status = typeof progress.status === 'string' ? progress.status : null;
      const file = typeof progress.file === 'string' ? progress.file : null;
      const percent = typeof progress.progress === 'number' ? `${Math.round(progress.progress)}%` : null;

      if (status === 'progress' && typeof progress.progress === 'number') {
        const progressFile = file ?? 'Downloading...';
        const progressBucket = Math.min(100, Math.floor(progress.progress / 5) * 5);
        if (progressFile === lastProgressFile && progressBucket === lastProgressBucket) {
          return;
        }
        lastProgressFile = progressFile;
        lastProgressBucket = progressBucket;
        emitPhase(`${progressFile} · ${progressBucket}%`);
        return;
      }

      if (status === 'done' && file) {
        emitPhase(`Loaded ${file}`);
        return;
      }

      const parts = [status, file, percent].filter(Boolean);
      if (parts.length) {
        emitPhase(parts.join(' · '));
      }
    },
  };

  if (shouldPreferQ4Load(task, modelId)) {
    loadOptions.dtype = 'q4';
    loadOptions.session_options = {
      enableCpuMemArena: false,
      enableMemPattern: false,
      graphOptimizationLevel: 'disabled',
      extra: {
        session: {
          use_ort_model_bytes_directly: '0',
        },
      },
    };
  }

  return loadOptions;
}

export function buildPipelineRunOptions(
  task: string,
  options: Record<string, unknown> | undefined,
  tokenizer: PreTrainedTokenizer | null,
  onToken: (token: string) => void,
) {
  if (!isStreamingTask(task)) {
    return { ...(options ?? {}) };
  }

  if (!tokenizer) {
    throw new Error('Text generation pipeline requires a tokenizer for Transformers v4 streaming. Ensure the pipeline is initialized with a valid tokenizer.');
  }

  return {
    max_new_tokens: 256,
    temperature: 0.7,
    do_sample: true,
    top_p: 0.9,
    return_full_text: false,
    ...(options ?? {}),
    streamer: new TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function(token) {
        onToken(token);
      },
    }),
  };
}

function formatPrimitive(value: string | number | boolean): string {
  return typeof value === 'string' ? value.trim() : String(value);
}

export function formatBrowserInferenceResult(result: unknown): string {
  if (result == null) return '';
  if (typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean') {
    return formatPrimitive(result);
  }

  if (Array.isArray(result)) {
    if (result.every((entry) => typeof entry === 'number')) {
      return JSON.stringify(result);
    }

    const parts = result.map((entry) => formatBrowserInferenceResult(entry)).filter(Boolean);
    return parts.join('\n').trim();
  }

  if (isRecord(result)) {
    for (const key of ['generated_text', 'summary_text', 'answer', 'text']) {
      const value = result[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    if (typeof result.label === 'string') {
      const score = typeof result.score === 'number' ? ` (${(result.score * 100).toFixed(1)}%)` : '';
      return `${result.label}${score}`;
    }

    return JSON.stringify(result, null, 2);
  }

  return String(result);
}
