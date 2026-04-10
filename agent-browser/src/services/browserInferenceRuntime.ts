import { TextStreamer, type PreTrainedTokenizer } from '@huggingface/transformers';
import type { OnnxDtype } from '../types';

type InferenceTask = 'text-generation' | 'text-classification' | 'question-answering' | 'feature-extraction' | 'summarization';

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

export function isStreamingTask(task: string): task is 'text-generation' {
  return task === 'text-generation';
}

export function buildPipelineLoadOptions(onPhase?: (phase: string) => void, dtype: OnnxDtype = 'q4') {
  return {
    dtype,
    device: 'wasm' as const,
    progress_callback(progress: ProgressInfo) {
      if (!onPhase) return;

      const status = typeof progress.status === 'string' ? progress.status : null;
      const file = typeof progress.file === 'string' ? progress.file : null;
      const percent = typeof progress.progress === 'number' ? `${Math.round(progress.progress)}%` : null;

      if (status === 'done' && file) {
        onPhase(`Loaded ${file}`);
        return;
      }

      const parts = [status, file, percent].filter(Boolean);
      if (parts.length) {
        onPhase(parts.join(' · '));
      }
    },
  };
}

export function buildPipelineRunOptions(
  task: InferenceTask,
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
