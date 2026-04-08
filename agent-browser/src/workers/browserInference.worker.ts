import { TextStreamer, pipeline } from '@huggingface/transformers';

type WorkerRequest =
  | { type: 'load'; id: string; task: string; modelId: string }
  | { type: 'generate'; id: string; task: string; modelId: string; prompt: unknown; options?: Record<string, unknown> };

const pipelines = new Map<string, Awaited<ReturnType<typeof pipeline>>>();

async function getPipeline(task: string, modelId: string) {
  const key = `${task}::${modelId}`;
  if (!pipelines.has(key)) {
    const loaded = await pipeline(task as never, modelId, { dtype: 'q4', device: 'wasm' });
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

    const pipe = (await getPipeline(data.task, data.modelId)) as any;
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
