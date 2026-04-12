// Matches the reference_impl TJS engine protocol (action-based messages, done/error responses).
import BrowserInferenceWorker from '../workers/browserInference.worker?worker';
import { createPrefixedId } from '../utils/uniqueId';

export type InferenceCallbacks = {
  onStatus?: (phase: string, msg: string, pct: number | null) => void;
  onPhase?: (phase: string) => void;
  onToken?: (token: string) => void;
  onDone?: (result: unknown) => void;
  onError?: (error: Error) => void;
};

class BrowserInferenceEngine {
  private worker: Worker | null = null;
  private workerFailed = false;
  private callbacks = new Map<string, InferenceCallbacks & { resolve: () => void; reject: (err: Error) => void }>();

  private getWorker(): Worker | null {
    if (this.workerFailed) return null;
    if (this.worker) return this.worker;
    try {
      this.worker = new BrowserInferenceWorker();
      this.worker.onmessage = (event: MessageEvent<Record<string, unknown>>) => {
        const d = event.data;
        const id = String(d.id ?? '');
        const cb = this.callbacks.get(id);

        // Status messages (progress) are broadcast to all callbacks, matching reference_impl
        if (d.type === 'status') {
          const phase = String(d.phase ?? '');
          const msg = String(d.msg ?? '');
          const pct = typeof d.pct === 'number' ? d.pct : null;
          this.callbacks.forEach((c) => c.onStatus?.(phase, msg, pct));
        }

        if (!cb) return;

        if (d.type === 'phase' && typeof d.phase === 'string') cb.onPhase?.(d.phase);
        if (d.type === 'token' && typeof d.token === 'string') cb.onToken?.(d.token);

        if (d.type === 'done') {
          this.callbacks.delete(id);
          cb.onDone?.(d.result);
          cb.resolve();
        }

        if (d.type === 'error') {
          const error = new Error(String(d.error ?? 'Worker error'));
          this.callbacks.delete(id);
          cb.onError?.(error);
          cb.reject(error);
        }
      };
      this.worker.onerror = (e: ErrorEvent) => {
        console.warn('TJS Worker error, all pending rejected:', e.message);
        this.workerFailed = true;
        this.worker = null;
        this.callbacks.forEach((cb) => cb.onError?.(new Error('Worker failed: ' + e.message)));
        this.callbacks.clear();
      };
    } catch (e) {
      console.warn('Cannot create TJS Worker:', e instanceof Error ? e.message : String(e));
      this.workerFailed = true;
    }
    return this.worker;
  }

  async loadModel(task: string, modelId: string, callbacks: Pick<InferenceCallbacks, 'onStatus' | 'onPhase' | 'onError'> = {}) {
    const id = createPrefixedId('load');
    const worker = this.getWorker();
    return new Promise<void>((resolve, reject) => {
      this.callbacks.set(id, {
        ...callbacks,
        onDone: () => { /* resolved via cb.resolve() */ },
        resolve,
        reject,
      });
      worker?.postMessage({ id, action: 'load', task, modelId });
      if (!worker) reject(new Error('Worker unavailable'));
    });
  }

  async generate(
    input: { task: string; modelId: string; prompt: unknown; options?: Record<string, unknown> },
    callbacks: InferenceCallbacks,
  ) {
    const id = createPrefixedId('gen');
    const worker = this.getWorker();
    return new Promise<void>((resolve, reject) => {
      this.callbacks.set(id, { ...callbacks, resolve, reject });
      worker?.postMessage({ id, action: 'generate', ...input, options: input.options ?? {} });
      if (!worker) reject(new Error('Worker unavailable'));
    });
  }
}

export const browserInferenceEngine = new BrowserInferenceEngine();
