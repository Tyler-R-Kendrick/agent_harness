import BrowserInferenceWorker from '../workers/browserInference.worker?worker';
import type { OnnxDtype } from '../types';

export type InferenceCallbacks = {
  onStatus?: (msg: string) => void;
  onPhase?: (phase: string) => void;
  onToken?: (token: string) => void;
  onDone?: (result: unknown) => void;
  onError?: (error: Error) => void;
};

class BrowserInferenceEngine {
  private worker: Worker | null = null;
  private pending = new Map<string, (payload: Record<string, unknown>) => void>();

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new BrowserInferenceWorker();
      this.worker.onmessage = (event: MessageEvent<Record<string, unknown>>) => {
        const id = String(event.data.id ?? '');
        const callback = this.pending.get(id);
        if (callback) callback(event.data);
      };
    }
    return this.worker;
  }

  async loadModel(task: string, modelId: string, dtype: OnnxDtype, callbacks: Pick<InferenceCallbacks, 'onStatus' | 'onPhase' | 'onError'> = {}) {
    const id = `load-${crypto.randomUUID()}`;
    const worker = this.getWorker();
    return new Promise<void>((resolve, reject) => {
      this.pending.set(id, (payload) => {
        if (payload.type === 'phase' && typeof payload.phase === 'string') callbacks.onPhase?.(payload.phase);
        if (payload.type === 'status' && typeof payload.msg === 'string') {
          callbacks.onStatus?.(payload.msg);
          this.pending.delete(id);
          resolve();
        }
        if (payload.type === 'error') {
          const error = new Error(String(payload.msg ?? 'Worker error'));
          callbacks.onError?.(error);
          this.pending.delete(id);
          reject(error);
        }
      });
      worker.postMessage({ type: 'load', id, task, modelId, dtype });
    });
  }

  async generate(input: { task: string; modelId: string; prompt: unknown; options?: Record<string, unknown> }, callbacks: InferenceCallbacks) {
    const id = `generate-${crypto.randomUUID()}`;
    const worker = this.getWorker();
    return new Promise<void>((resolve, reject) => {
      this.pending.set(id, (payload) => {
        if (payload.type === 'phase' && typeof payload.phase === 'string') callbacks.onPhase?.(payload.phase);
        if (payload.type === 'status' && typeof payload.msg === 'string') callbacks.onStatus?.(payload.msg);
        if (payload.type === 'token' && typeof payload.token === 'string') callbacks.onToken?.(payload.token);
        if (payload.type === 'done') {
          this.pending.delete(id);
          callbacks.onDone?.(payload.result);
          resolve();
        }
        if (payload.type === 'error') {
          const error = new Error(String(payload.msg ?? 'Worker error'));
          this.pending.delete(id);
          callbacks.onError?.(error);
          reject(error);
        }
      });
      worker.postMessage({ type: 'generate', id, ...input });
    });
  }
}

export const browserInferenceEngine = new BrowserInferenceEngine();
