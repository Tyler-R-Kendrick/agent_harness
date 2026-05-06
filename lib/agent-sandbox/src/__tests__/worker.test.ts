import { describe, expect, it } from 'vitest';
import type { SandboxWorkerMessage, SandboxWorkerRequest, SandboxWorkerResponse } from '../types';
import { createSandboxWorker, readWorkerRuntimeOptions } from '../sandbox.worker';
import { SandboxWorkerRuntime } from '../workerRuntime';

const encoder = new TextEncoder();

class WorkerTarget {
  readonly responses: SandboxWorkerResponse[] = [];
  private listener: ((event: MessageEvent<SandboxWorkerMessage>) => void) | null = null;

  addEventListener(type: 'message', listener: (event: MessageEvent<SandboxWorkerMessage>) => void): void {
    if (type === 'message') {
      this.listener = listener;
    }
  }

  removeEventListener(type: 'message', listener: (event: MessageEvent<SandboxWorkerMessage>) => void): void {
    if (type === 'message' && this.listener === listener) {
      this.listener = null;
    }
  }

  postMessage(response: SandboxWorkerResponse): void {
    this.responses.push(response);
  }

  dispatch(request: SandboxWorkerMessage): void {
    this.listener?.({ data: request } as MessageEvent<SandboxWorkerMessage>);
  }
}

async function waitForResponses(target: WorkerTarget, count: number): Promise<SandboxWorkerResponse[]> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (target.responses.length >= count) {
      return target.responses;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return target.responses;
}

describe('createSandboxWorker', () => {
  it('handles typed worker requests and posts typed responses', async () => {
    const target = new WorkerTarget();
    const worker = createSandboxWorker(target, new SandboxWorkerRuntime());

    target.dispatch({ id: 1, op: 'uploadFiles', payload: { files: [['/a.txt', encoder.encode('a')]] } });
    target.dispatch({ id: 2, op: 'downloadFiles', payload: { paths: ['/a.txt'] } });

    const responses = await waitForResponses(target, 2);

    expect(responses[0]).toEqual({ id: 1, ok: true, result: [{ path: '/a.txt', error: null }] });
    expect(responses[1]).toMatchObject({ id: 2, ok: true });
    worker.dispose();
    target.dispatch({ id: 3, op: 'reset' });
    expect(target.responses).toHaveLength(2);
  });

  it('returns useful errors for invalid worker operations', async () => {
    const target = new WorkerTarget();
    createSandboxWorker(target, new SandboxWorkerRuntime());

    target.dispatch({ id: 4, op: 'explode' } as unknown as SandboxWorkerRequest);

    const [response] = await waitForResponses(target, 1);

    expect(response).toEqual({ id: 4, ok: false, error: expect.stringContaining('Unsupported sandbox worker operation') });
  });

  it('returns useful errors for malformed worker messages and non-error rejections', async () => {
    const malformedTarget = new WorkerTarget();
    createSandboxWorker(malformedTarget, new SandboxWorkerRuntime());
    malformedTarget.dispatch({ id: 5 } as unknown as SandboxWorkerRequest);
    expect((await waitForResponses(malformedTarget, 1))[0]).toEqual({
      id: 5,
      ok: false,
      error: expect.stringContaining('Unsupported sandbox worker operation: unknown'),
    });

    const stringErrorTarget = new WorkerTarget();
    createSandboxWorker(stringErrorTarget, {
      handleRequest: () => Promise.reject('string failure'),
    } as unknown as SandboxWorkerRuntime);
    stringErrorTarget.dispatch({ id: 6, op: 'reset' });
    expect((await waitForResponses(stringErrorTarget, 1))[0]).toEqual({
      id: 6,
      ok: false,
      error: 'string failure',
    });
  });

  it('reads runtime options from a worker URL', () => {
    expect(readWorkerRuntimeOptions('')).toEqual({});
    expect(readWorkerRuntimeOptions()).toEqual({
      allowNetwork: false,
      maxFileBytes: undefined,
      maxOutputBytes: undefined,
      maxTotalBytes: undefined,
    });
    expect(readWorkerRuntimeOptions('https://worker.test/sandbox.worker.js?maxFileBytes=10&maxTotalBytes=bad&maxOutputBytes=20&allowNetwork=true')).toEqual({
      allowNetwork: true,
      maxFileBytes: 10,
      maxOutputBytes: 20,
      maxTotalBytes: undefined,
    });
  });

});
