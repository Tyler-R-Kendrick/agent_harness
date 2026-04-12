import { pipeline, type PreTrainedTokenizer } from '@huggingface/transformers';
import { buildPipelineLoadOptions, buildPipelineRunOptions } from '../services/browserInferenceRuntime';
import type { OnnxDtype } from '../types';

type WorkerRequest =
  | { type: 'load'; id: string; task: string; modelId: string; dtype?: OnnxDtype }
  | { type: 'generate'; id: string; task: string; modelId: string; prompt: unknown; options?: Record<string, unknown> };

type PipelineInstance = ((prompt: unknown, options?: Record<string, unknown>) => Promise<unknown>) & { tokenizer?: unknown };

const pipelines = new Map<string, unknown>();
const supportedPipelineTasks = new Set([
  'text-generation',
  'text-classification',
  'question-answering',
  'feature-extraction',
  'summarization',
]);

function assertSupportedTask(task: string): asserts task is 'text-generation' | 'text-classification' | 'question-answering' | 'feature-extraction' | 'summarization' {
  if (!supportedPipelineTasks.has(task)) {
    throw new Error(`Unsupported local pipeline task: ${task}`);
  }
}

async function getPipeline(task: string, modelId: string, onPhase?: (phase: string) => void, dtype?: OnnxDtype) {
  const key = `${task}::${modelId}`;
  if (!pipelines.has(key)) {
    assertSupportedTask(task);
    const loaded = await pipeline(task, modelId, buildPipelineLoadOptions(onPhase, dtype));
    pipelines.set(key, loaded);
  }
  return pipelines.get(key)!;
}

export async function handleMessage(data: WorkerRequest) {
  try {
    if (data.type === 'load') {
      postMessage({ type: 'phase', id: data.id, phase: 'Downloading model…' });
      await getPipeline(data.task, data.modelId, (phase) => postMessage({ type: 'phase', id: data.id, phase }), data.dtype);
      postMessage({ type: 'status', id: data.id, msg: 'ready' });
      return;
    }

    assertSupportedTask(data.task);
    const pipe = (await getPipeline(data.task, data.modelId, (phase) => postMessage({ type: 'phase', id: data.id, phase }))) as PipelineInstance;
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
