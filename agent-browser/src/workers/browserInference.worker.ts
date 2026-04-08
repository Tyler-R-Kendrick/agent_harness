import { TextStreamer, pipeline, type PreTrainedTokenizer } from '@huggingface/transformers';

type WorkerRequest =
  | { type: 'load'; id: string; task: string; modelId: string }
  | { type: 'generate'; id: string; task: string; modelId: string; prompt: unknown; options?: Record<string, unknown> };

type StreamablePipeline = ((prompt: unknown, options: Record<string, unknown>) => Promise<unknown>) & { tokenizer: PreTrainedTokenizer };

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

async function getPipeline(task: string, modelId: string) {
  const key = `${task}::${modelId}`;
  if (!pipelines.has(key)) {
    assertSupportedTask(task);
    const loaded = await pipeline(task, modelId, { dtype: 'q4', device: 'wasm' });
    pipelines.set(key, loaded);
  }
  return pipelines.get(key)!;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const data = event.data;
  try {
    if (data.type === 'load') {
      postMessage({ type: 'phase', id: data.id, phase: 'Downloading model…' });
      await getPipeline(data.task, data.modelId);
      postMessage({ type: 'status', id: data.id, msg: 'ready' });
      return;
    }

    const pipe = (await getPipeline(data.task, data.modelId)) as StreamablePipeline;
    const streamer = new TextStreamer(pipe.tokenizer, {
      skip_prompt: true,
      callback_function(token) {
        postMessage({ type: 'token', id: data.id, token });
      },
    });

    const result = await pipe(data.prompt, {
      max_new_tokens: 256,
      temperature: 0.7,
      do_sample: true,
      top_p: 0.9,
      ...data.options,
      streamer,
    });

    postMessage({ type: 'done', id: data.id, result });
  } catch (error) {
    postMessage({ type: 'error', id: data.id, msg: error instanceof Error ? error.message : String(error) });
  }
};
