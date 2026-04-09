/* ═══════════ Transformers.js Web Worker (Classic) ═══════════
   Runs model inference off the main thread.
   Uses dynamic import() which Chrome supports in classic workers.
   Falls back to fetch+Blob for restricted origins.
*/
const TJS_CDN = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/dist/transformers.js";

let lib = null;
const pipelines = {};

async function loadLib() {
  if (lib) return lib;
  self.postMessage({ type: "status", phase: "lib", msg: "Downloading transformers.js library...", pct: null });
  try {
    lib = await import(TJS_CDN);
  } catch (e1) {
    self.postMessage({ type: "status", phase: "lib", msg: "Loading library (fallback)...", pct: null });
    try {
      const resp = await fetch(TJS_CDN);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const text = await resp.text();
      const blob = new Blob([text], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      lib = await import(url);
      URL.revokeObjectURL(url);
    } catch (e2) {
      throw new Error("Cannot load transformers.js: " + e1.message + " / fallback: " + e2.message);
    }
  }
  return lib;
}

async function getPipeline(task, modelId) {
  const key = modelId + ":" + task;
  if (pipelines[key]) return pipelines[key];
  await loadLib();
  self.postMessage({ type: "status", phase: "model", msg: "Loading model weights...", pct: 0 });
  const pipe = await lib.pipeline(task, modelId, {
    progress_callback: (p) => {
      if (p.status === "progress" && p.progress != null) {
        self.postMessage({ type: "status", phase: "model", msg: p.file || "Downloading...", pct: Math.round(p.progress) });
      } else if (p.status === "download") {
        self.postMessage({ type: "status", phase: "model", msg: p.file || "Starting download...", pct: null });
      } else if (p.status === "initiate") {
        self.postMessage({ type: "status", phase: "model", msg: p.file || "Initializing...", pct: null });
      } else if (p.status === "done" || p.status === "ready") {
        self.postMessage({ type: "status", phase: "model", msg: p.file || "Finalizing...", pct: 100 });
      }
    },
  });
  pipelines[key] = pipe;
  return pipe;
}

self.onerror = (e) => { self.postMessage({ type: "error", id: "__global", error: "Worker error: " + (e.message || e) }) };

self.onmessage = async (e) => {
  const { id, action } = e.data;
  if (!id) return;
  try {
    if (action === "ping") {
      self.postMessage({ type: "done", id, result: { pong: true } });
      return;
    }
    if (action === "load") {
      const { task, modelId } = e.data;
      await getPipeline(task, modelId);
      self.postMessage({ type: "done", id, result: { loaded: true } });
      return;
    }
    if (action === "generate") {
      const { task, modelId, prompt, options } = e.data;
      const pipe = await getPipeline(task, modelId);
      self.postMessage({ type: "phase", id, phase: "thinking" });

      if (task === "text-generation") {
        self.postMessage({ type: "phase", id, phase: "generating" });
        const streamer = new lib.TextStreamer(pipe.tokenizer, {
          skip_prompt: true,
          callback_function: (token) => {
            self.postMessage({ type: "token", id, token });
          }
        });
        const result = await pipe(prompt, {
          max_new_tokens: options.max_new_tokens || 256,
          temperature: options.temperature || 0.7,
          do_sample: options.do_sample !== false,
          top_p: options.top_p || 0.9,
          streamer,
        });
        self.postMessage({ type: "done", id, result: { text: result[0]?.generated_text || "" } });

      } else if (task === "text2text-generation" || task === "translation" || task === "summarization") {
        self.postMessage({ type: "phase", id, phase: "generating" });
        const result = await pipe(prompt, { max_new_tokens: options.max_new_tokens || 256 });
        const text = result[0]?.generated_text || result[0]?.translation_text || result[0]?.summary_text || JSON.stringify(result);
        self.postMessage({ type: "token", id, token: text });
        self.postMessage({ type: "done", id, result: { text } });

      } else if (task === "text-classification" || task === "sentiment-analysis") {
        self.postMessage({ type: "phase", id, phase: "generating" });
        const result = await pipe(prompt);
        const text = (result || []).map(r => r.label + " (" + Math.round(r.score * 100) + "%)").join(", ");
        self.postMessage({ type: "token", id, token: text });
        self.postMessage({ type: "done", id, result: { text } });

      } else if (task === "question-answering") {
        self.postMessage({ type: "phase", id, phase: "generating" });
        const result = await pipe(prompt);
        const text = result.answer || JSON.stringify(result);
        self.postMessage({ type: "token", id, token: text });
        self.postMessage({ type: "done", id, result: { text } });

      } else if (task === "feature-extraction") {
        self.postMessage({ type: "phase", id, phase: "generating" });
        const result = await pipe(prompt, { pooling: "mean", normalize: true });
        const dim = result?.data?.length || result?.size || "?";
        const text = "Generated embedding vector (" + dim + " dimensions).";
        self.postMessage({ type: "token", id, token: text });
        self.postMessage({ type: "done", id, result: { text } });

      } else {
        self.postMessage({ type: "phase", id, phase: "generating" });
        const result = await pipe(prompt);
        const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
        self.postMessage({ type: "token", id, token: text });
        self.postMessage({ type: "done", id, result: { text } });
      }
    }
  } catch (err) {
    self.postMessage({ type: "error", id, error: err.message || String(err) });
  }
};
