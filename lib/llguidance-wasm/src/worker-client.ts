import type {
  CommitResult,
  GrammarInput,
  LlgSessionOptions,
  LlguidanceWorkerResponse,
  WorkerCreateMatcherResult,
  WorkerInitResult,
  WorkerMaskResult
} from './types.js';

export interface WorkerLike {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}

export class LlguidanceWorkerClient {
  private nextId = 1;
  private readonly pending = new Map<number, {
    resolve(value: unknown): void;
    reject(reason?: unknown): void;
  }>();
  private readonly worker: WorkerLike;

  constructor(worker: WorkerLike) {
    this.worker = worker;
    worker.addEventListener('message', ({ data }) => this.handleResponse(data as LlguidanceWorkerResponse));
  }

  init(tokenizerJson: string, options?: LlgSessionOptions): Promise<WorkerInitResult> {
    return this.request({ op: 'init', tokenizerJson, options });
  }

  createMatcher(input: GrammarInput): Promise<WorkerCreateMatcherResult> {
    return this.request({ op: 'createMatcher', input });
  }

  computeMask(matcherId: number): Promise<WorkerMaskResult> {
    return this.request({ op: 'computeMask', matcherId });
  }

  commitToken(matcherId: number, tokenId: number): Promise<CommitResult> {
    return this.request({ op: 'commitToken', matcherId, tokenId });
  }

  freeMatcher(matcherId: number): Promise<{ freed: true }> {
    return this.request({ op: 'freeMatcher', matcherId });
  }

  private request<T>(message: Record<string, unknown>): Promise<T> {
    const id = this.nextId++;
    const promise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    });
    this.worker.postMessage({ id, ...message });
    return promise;
  }

  private handleResponse(response: LlguidanceWorkerResponse): void {
    const pending = this.pending.get(response.id);
    if (!pending) {
      return;
    }

    this.pending.delete(response.id);
    if (response.ok) {
      pending.resolve(response.result);
    } else {
      pending.reject(new Error(response.error));
    }
  }
}
