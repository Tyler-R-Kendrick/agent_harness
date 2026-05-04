// TypeScript port of reference_impl/tjs-worker.js
// Keeps the same message protocol and per-task generate logic as the reference.

import { env, pipeline, type PreTrainedTokenizer } from '@huggingface/transformers';
import {
  buildPipelineLoadOptions,
  buildPipelineRunOptions,
  compactPromptForBrowserInference,
  formatBrowserInferenceResult,
  isStreamingTask,
  normalizeBrowserInferenceErrorMessage,
} from '../services/browserInferenceRuntime';

type AnyPipeline = (prompt: unknown, options?: Record<string, unknown>) => Promise<unknown>;
type PipelineWithTokenizer = AnyPipeline & { tokenizer?: unknown };

const pipelines = new Map<string, unknown>();

function postProgress(phase: string, msg: string, pct: number | null) {
  postMessage({ type: 'status', phase, msg, pct });
}

function configureRuntimeForModel(task: string, modelId: string) {
  if (task !== 'text-generation' || !/qwen3-0\.6b-onnx/i.test(modelId)) {
    return;
  }

  const wasm = env.backends?.onnx?.wasm;
  // Keep `env.useBrowserCache` enabled (default `true`) so installed model
  // weights persist in the browser cache across page refreshes. Disabling it
  // here previously forced a full re-download of every model after reload.

  if (!wasm) {
    return;
  }

  wasm.proxy = true;
  wasm.numThreads = 1;
}

function shouldPreferWebGpuForModel(task: string, modelId: string) {
  return task === 'text-generation'
    && /qwen3-0\.6b-onnx/i.test(modelId)
    && typeof navigator !== 'undefined'
    && 'gpu' in navigator;
}

async function getPipeline(task: string, modelId: string): Promise<PipelineWithTokenizer> {
  const key = `${modelId}:${task}`;
  if (pipelines.has(key)) return pipelines.get(key) as PipelineWithTokenizer;

  postProgress('model', 'Loading model weights...', 0);
  configureRuntimeForModel(task, modelId);
  const loadOptions = buildPipelineLoadOptions(task, modelId, (phase) => postProgress('model', phase, null));
  if (shouldPreferWebGpuForModel(task, modelId)) {
    loadOptions.device = 'webgpu';
  }
  const pipe = await pipeline(
    task as Parameters<typeof pipeline>[0],
    modelId,
    loadOptions,
  );
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
      const compactedPrompt = compactPromptForBrowserInference(prompt);
      postMessage({ type: 'phase', id, phase: 'thinking' });
      postMessage({ type: 'phase', id, phase: 'generating' });

      if (task === 'feature-extraction') {
        const result = await pipe(compactedPrompt, { pooling: 'mean', normalize: true }) as { data?: unknown[]; size?: unknown };
        const dim = result?.data?.length ?? result?.size ?? '?';
        const text = `Generated embedding vector (${String(dim)} dimensions).`;
        postMessage({ type: 'token', id, token: text });
        postMessage({ type: 'done', id, result: { text } });
      } else {
        const runOptions = buildPipelineRunOptions(
          task, options, (pipe.tokenizer as PreTrainedTokenizer) ?? null,
          (token) => postMessage({ type: 'token', id, token }),
        );
        const result = await pipe(compactedPrompt, runOptions);
        const text = isStreamingTask(task)
          ? (result as Array<{ generated_text?: string }>)[0]?.generated_text ?? ''
          : formatBrowserInferenceResult(result);
        if (!isStreamingTask(task)) {
          postMessage({ type: 'token', id, token: text });
        }
        postMessage({ type: 'done', id, result: { text } });
      }
    }
  } catch (err) {
    postMessage({ type: 'error', id, error: normalizeBrowserInferenceErrorMessage(err) });
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
