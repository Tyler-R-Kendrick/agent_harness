import { describe, expect, it } from 'vitest';
import {
  DefaultCapabilitySet,
  EventJobAccepted,
  EventJobCompleted,
  SurfaceWorkerProvider,
  capabilityId,
  jobIntentId,
  providerId,
  runtimeTypeId,
  workerTypeId,
  type ProviderContext,
} from '@agent-harness/worker';
import {
  DaemonRuntimeType,
  DaemonWorkerProvider,
  DaemonWorkerProviderId,
  DaemonWorkerType,
  type DaemonTransport,
} from '../index';

class RecordingTransport implements DaemonTransport {
  requests: Array<{ action: string; payload: unknown }> = [];
  response: unknown = null;
  throwValue: unknown = null;

  async request(action: string, payload: unknown): Promise<unknown> {
    if (this.throwValue) {
      throw this.throwValue;
    }
    this.requests.push({ action, payload });
    return this.response ?? { action, ok: true };
  }
}

function createContext(useClock = true): ProviderContext {
  const context: ProviderContext = {
    registry: null as never,
    sandboxBroker: null as never,
    policyEngine: null as never,
  };
  if (useClock) {
    context.clock = { now: () => new Date('2026-01-02T03:04:05.000Z') };
  }
  return context;
}

describe('DaemonWorkerProvider', () => {
  it('describes daemon workers as provider-owned worker implementations', async () => {
    const provider = new DaemonWorkerProvider({
      transport: new RecordingTransport(),
      providerId: providerId('com.acme.daemon-provider'),
      workerType: workerTypeId('com.acme.worker.daemon'),
      runtimeType: runtimeTypeId('com.acme.runtime.daemon'),
      displayName: 'Custom Daemon Provider',
    });

    await expect(provider.describe()).resolves.toMatchObject({
      ref: { id: providerId('com.acme.daemon-provider') },
      displayName: 'Custom Daemon Provider',
      provides: [{ id: SurfaceWorkerProvider }],
    });
    await expect(provider.listWorkers?.()).resolves.toMatchObject([
      {
        ref: { type: workerTypeId('com.acme.worker.daemon') },
        runtime: { type: runtimeTypeId('com.acme.runtime.daemon') },
      },
    ]);
    expect(DaemonWorkerProviderId).toBe('com.example.worker-provider.daemon');
  });

  it('adapts daemon actions into worker jobs without exposing shell execution', async () => {
    const transport = new RecordingTransport();
    const provider = new DaemonWorkerProvider({
      transport,
      capabilities: new DefaultCapabilitySet([{ id: capabilityId('cap.daemon.local-inference') }]),
    });
    const worker = await provider.createWorker?.({}, createContext());
    await expect(worker!.describe()).resolves.toMatchObject({
      ref: { type: DaemonWorkerType },
      runtime: { type: DaemonRuntimeType },
    });

    const run = await worker!.submit({
      id: 'job-1',
      intent: jobIntentId('daemon.request'),
      input: { action: 'ping', payload: { nonce: 'abc' } },
    });
    const events = [];
    for await (const event of run.events()) {
      events.push(event);
    }

    await expect(run.result()).resolves.toMatchObject({
      status: 'succeeded',
      output: JSON.stringify({ action: 'ping', ok: true }),
    });
    expect(transport.requests).toEqual([{ action: 'ping', payload: { nonce: 'abc' } }]);
    expect(events.map((event) => event.type)).toEqual([EventJobAccepted, EventJobCompleted]);
    expect(events[0]!.timestamp).toBe('2026-01-02T03:04:05.000Z');
  });

  it('fails unsupported daemon input shapes as worker diagnostics', async () => {
    const provider = new DaemonWorkerProvider({ transport: new RecordingTransport(), providerId: providerId('com.acme.daemon') });
    const worker = await provider.createWorker?.({}, createContext());
    const run = await worker!.submit({
      id: 'job-1',
      intent: jobIntentId('daemon.request'),
      input: { command: 'rm -rf /' },
    });

    await expect(run.result()).resolves.toMatchObject({
      status: 'failed',
      diagnostics: [{ severity: 'error', message: expect.stringContaining('action') }],
    });

    const nullRun = await worker!.submit({
      id: 'job-2',
      intent: jobIntentId('daemon.request'),
      input: null,
    });
    await expect(nullRun.result()).resolves.toMatchObject({
      status: 'failed',
      diagnostics: [{ severity: 'error', message: expect.stringContaining('object') }],
    });
  });

  it('serializes string responses, non-Error failures, and cancellation', async () => {
    const transport = new RecordingTransport();
    transport.response = 'pong';
    const worker = await new DaemonWorkerProvider({ transport }).createWorker?.({}, createContext(false));

    const run = await worker!.submit({
      id: 'job-1',
      intent: jobIntentId('daemon.request'),
      input: { action: 'ping' },
    });
    await run.cancel();
    await expect(run.result()).resolves.toMatchObject({
      status: 'cancelled',
      output: 'pong',
    });

    const throwingTransport = new RecordingTransport();
    throwingTransport.throwValue = 'daemon exploded';
    const throwingWorker = await new DaemonWorkerProvider({ transport: throwingTransport }).createWorker?.({}, createContext());
    const failedRun = await throwingWorker!.submit({
      id: 'job-2',
      intent: jobIntentId('daemon.request'),
      input: { action: 'ping' },
    });
    await expect(failedRun.result()).resolves.toMatchObject({
      status: 'failed',
      error: { name: 'Error', message: 'daemon exploded' },
    });
  });
});
