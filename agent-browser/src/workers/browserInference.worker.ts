import { pipeline, type PreTrainedTokenizer } from '@huggingface/transformers';
import { buildPipelineRunOptions } from '../services/browserInferenceRuntime';

type WorkerRequest =
  | { type: 'load'; id: string; task: string; modelId: string }
  | { type: 'generate'; id: string; task: string; modelId: string; prompt: unknown; options?: Record<string, unknown> };

type PipelineInstance = ((prompt: unknown, options?: Record<string, unknown>) => Promise<unknown>) & { tokenizer?: unknown };

type ProgressInfo = {
  status?: unknown;
  file?: unknown;
  progress?: unknown;
};

const pipelines = new Map<string, unknown>();

function buildProgressCallback(id: string) {
  return (p: ProgressInfo) => {
    const status = typeof p.status === 'string' ? p.status : null;
    const file = typeof p.file === 'string' ? p.file : null;
    const pct = typeof p.progress === 'number' ? Math.round(p.progress) : null;

    if (status === 'progress' && pct != null) {
      postMessage({ type: 'phase', id, phase: `${file ?? 'Downloading…'} ${pct}%` });
    } else if (status === 'download') {
      postMessage({ type: 'phase', id, phase: file ?? 'Starting download…' });
    } else if (status === 'initiate') {
      postMessage({ type: 'phase', id, phase: file ?? 'Initializing…' });
    } else if (status === 'done' || status === 'ready') {
      postMessage({ type: 'phase', id, phase: file ? `Loaded ${file}` : 'Finalizing…' });
    }
  };
}

async function getPipeline(task: string, modelId: string, id: string) {
  const key = `${task}::${modelId}`;
  if (!pipelines.has(key)) {
    // Match reference_impl: call pipeline(task, modelId) with only a progress_callback —
    // no dtype or device override. Transformers.js auto-selects the best available weights.
    const loaded = await pipeline(task as Parameters<typeof pipeline>[0], modelId, {
      progress_callback: buildProgressCallback(id),
    });
    pipelines.set(key, loaded);
  }
  return pipelines.get(key)!;
}

export async function handleMessage(data: WorkerRequest) {
  try {
    if (data.type === 'load') {
      postMessage({ type: 'phase', id: data.id, phase: 'Loading model…' });
      await getPipeline(data.task, data.modelId, data.id);
      postMessage({ type: 'status', id: data.id, msg: 'ready' });
      return;
    }

    const pipe = (await getPipeline(data.task, data.modelId, data.id)) as PipelineInstance;
    const result = await pipe(
      data.prompt,
      buildPipelineRunOptions(data.task, data.options, (pipe.tokenizer as PreTrainedTokenizer | null | undefined) ?? null, (token) => {
        postMessage({ type: 'token', id: data.id, token });
      }),
    );

    postMessage({ type: 'done', id: data.id, result });
  } catch (error) {
    postMessage({ type: 'error', id: data.id, msg: error instanceof Error ? error.message : String(error) });
  }
}

if (typeof self !== 'undefined') {
  self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    await handleMessage(event.data);
  };
}
