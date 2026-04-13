// TypeScript port of reference_impl/tjs-worker.js
// Keeps the same message protocol and per-task generate logic as the reference.

import { pipeline, TextStreamer } from '@huggingface/transformers';

type ProgressInfo = {
  status?: unknown;
  file?: unknown;
  progress?: unknown;
};

type AnyPipeline = (prompt: unknown, options?: Record<string, unknown>) => Promise<unknown>;
type PipelineWithTokenizer = AnyPipeline & { tokenizer?: unknown };

const pipelines = new Map<string, unknown>();

function postProgress(phase: string, msg: string, pct: number | null) {
  postMessage({ type: 'status', phase, msg, pct });
}

async function getPipeline(task: string, modelId: string): Promise<PipelineWithTokenizer> {
  const key = `${modelId}:${task}`;
  if (pipelines.has(key)) return pipelines.get(key) as PipelineWithTokenizer;

  postProgress('model', 'Loading model weights...', 0);
  const pipe = await pipeline(task as Parameters<typeof pipeline>[0], modelId, {
    progress_callback: (p: ProgressInfo) => {
      const status = typeof p.status === 'string' ? p.status : null;
      const file = typeof p.file === 'string' ? p.file : null;
      const pct = typeof p.progress === 'number' ? Math.round(p.progress) : null;

      if (status === 'progress' && pct != null) {
        postProgress('model', file ?? 'Downloading...', pct);
      } else if (status === 'download') {
        postProgress('model', file ?? 'Starting download...', null);
      } else if (status === 'initiate') {
        postProgress('model', file ?? 'Initializing...', null);
      } else if (status === 'done' || status === 'ready') {
        postProgress('model', file ?? 'Finalizing...', 100);
      }
    },
  });
  pipelines.set(key, pipe);
  return pipe as PipelineWithTokenizer;
}

export type WorkerRequest =
  | { id: string; action: 'ping' }
  | { id: string; action: 'load'; task: string; modelId: string }
  | { id: string; action: 'generate'; task: string; modelId: string; prompt: unknown; options: Record<string, unknown> };

export async function handleMessage(data: WorkerRequest) {
  const { id, action } = data;
  try {
    if (action === 'ping') {
      postMessage({ type: 'done', id, result: { pong: true } });
      return;
    }

    if (action === 'load') {
      const { task, modelId } = data;
      await getPipeline(task, modelId);
      postMessage({ type: 'done', id, result: { loaded: true } });
      return;
    }

    if (action === 'generate') {
      const { task, modelId, prompt, options } = data;
      const pipe = await getPipeline(task, modelId);
      postMessage({ type: 'phase', id, phase: 'thinking' });

      if (task === 'text-generation') {
        postMessage({ type: 'phase', id, phase: 'generating' });
        // pipe.tokenizer is the PreTrainedTokenizer attached by the pipeline; cast required
        // because the PipelineWithTokenizer type uses `unknown` for compatibility with all pipeline types.
        const streamer = new TextStreamer(pipe.tokenizer as import('@huggingface/transformers').PreTrainedTokenizer, {
          skip_prompt: true,
          skip_special_tokens: true,
          callback_function: (token: string) => {
            postMessage({ type: 'token', id, token });
          },
        });
        const result = await pipe(prompt, {
          max_new_tokens: (options.max_new_tokens as number) || 256,
          temperature: (options.temperature as number) || 0.7,
          do_sample: options.do_sample !== false,
          top_p: (options.top_p as number) || 0.9,
          streamer,
        }) as Array<{ generated_text?: string }>;
        postMessage({ type: 'done', id, result: { text: result[0]?.generated_text ?? '' } });

      } else if (task === 'text2text-generation' || task === 'translation' || task === 'summarization') {
        postMessage({ type: 'phase', id, phase: 'generating' });
        const result = await pipe(prompt, { max_new_tokens: (options.max_new_tokens as number) || 256 }) as Array<Record<string, string>>;
        // Pick the first non-null text field in priority order matching the reference_impl
        const text = result[0]?.generated_text ?? result[0]?.translation_text ?? result[0]?.summary_text ?? JSON.stringify(result);
        postMessage({ type: 'token', id, token: text });
        postMessage({ type: 'done', id, result: { text } });

      } else if (task === 'text-classification' || task === 'sentiment-analysis') {
        postMessage({ type: 'phase', id, phase: 'generating' });
        const result = await pipe(prompt) as Array<{ label: string; score: number }>;
        const text = (result || []).map((r) => `${r.label} (${Math.round(r.score * 100)}%)`).join(', ');
        postMessage({ type: 'token', id, token: text });
        postMessage({ type: 'done', id, result: { text } });

      } else if (task === 'question-answering') {
        postMessage({ type: 'phase', id, phase: 'generating' });
        const result = await pipe(prompt) as { answer?: string };
        const text = result.answer ?? JSON.stringify(result);
        postMessage({ type: 'token', id, token: text });
        postMessage({ type: 'done', id, result: { text } });

      } else if (task === 'feature-extraction') {
        postMessage({ type: 'phase', id, phase: 'generating' });
        const result = await pipe(prompt, { pooling: 'mean', normalize: true }) as { data?: unknown[]; size?: unknown };
        const dim = result?.data?.length ?? result?.size ?? '?';
        const text = `Generated embedding vector (${String(dim)} dimensions).`;
        postMessage({ type: 'token', id, token: text });
        postMessage({ type: 'done', id, result: { text } });

      } else {
        postMessage({ type: 'phase', id, phase: 'generating' });
        const result = await pipe(prompt) as unknown;
        const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        postMessage({ type: 'token', id, token: text });
        postMessage({ type: 'done', id, result: { text } });
      }
    }
  } catch (err) {
    postMessage({ type: 'error', id, error: err instanceof Error ? err.message : String(err) });
  }
}

if (typeof self !== 'undefined') {
  // Match reference_impl: guard against messages with no id (internal worker messages etc)
  self.onerror = (e) => {
    const msg = e instanceof ErrorEvent ? e.message : String(e);
    self.postMessage({ type: 'error', id: '__global', error: 'Worker: ' + msg });
  };

  self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    // Guard against messages with no id — matches reference_impl's `if(!id) return` check,
    // which protects against browser-internal worker messages that have no application id.
    if (!event.data?.id) return;
    await handleMessage(event.data);
  };
}
