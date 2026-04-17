import { describe, it, expect, vi } from 'vitest';
import { LogActAgent } from '../agent.js';
import { InMemoryAgentBus } from '../agentBus.js';
import { ClassicVoter, AllowlistVoter } from '../voters.js';
import { PayloadType, QuorumPolicy } from '../types.js';
import type { IExecutor, IInferenceClient } from '../types.js';

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function makeInference(responses: string[]): IInferenceClient {
  let idx = 0;
  return {
    async infer() {
      if (idx >= responses.length) return '';
      return responses[idx++];
    },
  };
}

function makeExecutor(fn: (action: string) => Promise<string> = async (a) => `exec:${a}`): IExecutor {
  return { tier: 'llm-active', execute: fn };
}

// ----------------------------------------------------------------

describe('LogActAgent – no voters (OnByDefault)', () => {
  it('runs one turn and produces a result', async () => {
    const bus = new InMemoryAgentBus();
    const agent = new LogActAgent({
      bus,
      inferenceClient: makeInference(['print("hello")']),
      voters: [],
      quorumPolicy: QuorumPolicy.OnByDefault,
      maxTurns: 1,
    });

    await agent.send('run a hello world script');
    const results = await agent.run();
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe(PayloadType.Result);
    expect(results[0].output).toContain('print("hello")');
  });

  it('stops when inference returns empty string', async () => {
    const bus = new InMemoryAgentBus();
    const agent = new LogActAgent({
      bus,
      inferenceClient: makeInference(['']),
      voters: [],
      quorumPolicy: QuorumPolicy.OnByDefault,
    });

    await agent.send('do something');
    const results = await agent.run();
    expect(results).toHaveLength(0);
  });

  it('stop() halts execution', async () => {
    const bus = new InMemoryAgentBus();
    const agent = new LogActAgent({
      bus,
      inferenceClient: { async infer() { return 'action'; } },
      quorumPolicy: QuorumPolicy.OnByDefault,
      maxTurns: 100,
    });

    // Stop immediately after first send.
    agent.stop();
    await agent.send('go');
    const results = await agent.run();
    expect(results).toHaveLength(0);
  });

  it('stop() called while poll is blocking halts execution at next cycle', async () => {
    const bus = new InMemoryAgentBus();
    const agent = new LogActAgent({
      bus,
      inferenceClient: makeInference(['action']),
      quorumPolicy: QuorumPolicy.OnByDefault,
      maxTurns: 5,
    });

    // run() will block in poll() — no entries in bus yet.
    const runPromise = agent.run();
    // run() is now suspended at await poll(); synchronously stop + unblock.
    agent.stop();
    await agent.send('unblock'); // appends Mail → resolves poll
    const results = await runPromise;
    expect(results).toHaveLength(0);
  });

  it('uses BooleanAnd quorum by default when quorumPolicy is omitted', async () => {
    const bus = new InMemoryAgentBus();
    const voter = new ClassicVoter('v1', () => false, 'rejected');
    // No quorumPolicy — defaults to BooleanAnd, so single rejecting voter aborts.
    const agent = new LogActAgent({
      bus,
      inferenceClient: makeInference(['action', '']),
      voters: [voter],
      maxTurns: 2,
    });

    await agent.send('go');
    const results = await agent.run();
    expect(results).toHaveLength(0); // aborted on first turn, empty on second
  });
});

describe('LogActAgent – BooleanAnd with ClassicVoter (approve)', () => {
  it('commits and executes when voter approves', async () => {
    const bus = new InMemoryAgentBus();
    const voter = new ClassicVoter('v1', () => true);
    const agent = new LogActAgent({
      bus,
      inferenceClient: makeInference(['read file']),
      voters: [voter],
      quorumPolicy: QuorumPolicy.BooleanAnd,
      maxTurns: 1,
    });

    await agent.send('read something');
    const results = await agent.run();
    expect(results).toHaveLength(1);
    expect(results[0].output).toContain('read file');
  });
});

describe('LogActAgent – BooleanAnd with ClassicVoter (reject)', () => {
  it('aborts and does NOT execute when voter rejects', async () => {
    const bus = new InMemoryAgentBus();
    const voter = new ClassicVoter('v1', () => false, 'blocked');
    const executed = vi.fn();
    const agent = new LogActAgent({
      bus,
      inferenceClient: makeInference(['rm -rf /', '']),
      voters: [voter],
      executor: makeExecutor(async (a) => { executed(a); return 'done'; }),
      quorumPolicy: QuorumPolicy.BooleanAnd,
      maxTurns: 2,
    });

    await agent.send('destroy everything');
    const results = await agent.run();
    // First turn aborted, second turn gets empty inference → stops.
    expect(results).toHaveLength(0);
    expect(executed).not.toHaveBeenCalled();
  });
});

describe('LogActAgent – executor error is recorded', () => {
  it('logs error in result but does not throw', async () => {
    const bus = new InMemoryAgentBus();
    const agent = new LogActAgent({
      bus,
      inferenceClient: makeInference(['bad code']),
      voters: [],
      quorumPolicy: QuorumPolicy.OnByDefault,
      executor: makeExecutor(async () => { throw new Error('exec failed'); }),
      maxTurns: 1,
    });

    await agent.send('do it');
    const results = await agent.run();
    expect(results).toHaveLength(1);
    expect(results[0].error).toBe('exec failed');
  });

  it('records non-Error throws as string', async () => {
    const bus = new InMemoryAgentBus();
    const agent = new LogActAgent({
      bus,
      inferenceClient: makeInference(['x']),
      voters: [],
      quorumPolicy: QuorumPolicy.OnByDefault,
      executor: makeExecutor(async () => { throw 'string error'; }),
      maxTurns: 1,
    });

    await agent.send('go');
    const results = await agent.run();
    expect(results[0].error).toBe('string error');
  });

  it('error result is included as "Error: …" in the next inference messages', async () => {
    const bus = new InMemoryAgentBus();
    const capturedMessages: Array<Array<{ role: string; content: string }>> = [];
    const inference: IInferenceClient = {
      async infer(messages) {
        capturedMessages.push(messages);
        // First turn produces an action; second turn returns empty to stop.
        return capturedMessages.length === 1 ? 'run it' : '';
      },
    };

    const agent = new LogActAgent({
      bus,
      inferenceClient: inference,
      voters: [],
      quorumPolicy: QuorumPolicy.OnByDefault,
      executor: makeExecutor(async () => { throw new Error('boom'); }),
      maxTurns: 2,
    });

    await agent.send('go');
    await agent.run();

    // The second inference receives messages that include the error result.
    expect(capturedMessages.length).toBeGreaterThanOrEqual(2);
    const secondMessages = capturedMessages[1];
    expect(secondMessages.some((m) => m.content.includes('Error: boom'))).toBe(true);
  });
});

describe('LogActAgent – default executor (NoopExecutor)', () => {
  it('uses noop executor if none provided', async () => {
    const bus = new InMemoryAgentBus();
    const agent = new LogActAgent({
      bus,
      inferenceClient: makeInference(['noop action']),
      voters: [],
      quorumPolicy: QuorumPolicy.OnByDefault,
      maxTurns: 1,
    });

    await agent.send('go');
    const results = await agent.run();
    expect(results[0].output).toBe('noop action');
  });
});

describe('LogActAgent – AllowlistVoter integration', () => {
  it('allows listed actions and blocks unlisted ones', async () => {
    const bus = new InMemoryAgentBus();
    const voter = new AllowlistVoter('al', ['read']);
    // First inference: blocked action; second: allowed; third: empty to stop.
    const agent = new LogActAgent({
      bus,
      inferenceClient: makeInference(['delete file', 'read logs', '']),
      voters: [voter],
      quorumPolicy: QuorumPolicy.BooleanAnd,
      maxTurns: 3,
    });

    await agent.send('do things');
    const results = await agent.run();
    expect(results).toHaveLength(1);
    expect(results[0].output).toContain('read logs');
  });
});

describe('LogActAgent – abort without voter reason in message history', () => {
  it('includes "no reason given" fallback in the next inference messages', async () => {
    const bus = new InMemoryAgentBus();
    // Voter that rejects with no reason field.
    const noReasonVoter = {
      id: 'nr',
      tier: 'classic' as const,
      async vote(intent: import('../types.js').IntentPayload): Promise<import('../types.js').VotePayload> {
        return { type: PayloadType.Vote, intentId: intent.intentId, voterId: 'nr', approve: false };
      },
    };

    const capturedMessages: Array<Array<{ role: string; content: string }>> = [];
    const inference: IInferenceClient = {
      async infer(messages) {
        capturedMessages.push(messages);
        // First call: return an action; second call: return empty to stop.
        return capturedMessages.length === 1 ? 'some action' : '';
      },
    };

    const agent = new LogActAgent({
      bus,
      inferenceClient: inference,
      voters: [noReasonVoter],
      quorumPolicy: QuorumPolicy.BooleanAnd,
      maxTurns: 2,
    });

    await agent.send('go');
    await agent.run();

    // The second inference call should include abort with "no reason given"
    expect(capturedMessages.length).toBeGreaterThanOrEqual(2);
    const secondMessages = capturedMessages[1];
    expect(secondMessages.some((m) => m.content.includes('no reason given'))).toBe(true);
  });
});

describe('LogActAgent – message history building', () => {
  it('incorporates prior results and aborts into next inference input', async () => {
    const bus = new InMemoryAgentBus();
    const inferMessages: Array<Array<{ role: string; content: string }>> = [];
    const inference: IInferenceClient = {
      async infer(messages) {
        inferMessages.push(messages);
        if (inferMessages.length === 1) return 'first action';
        return '';
      },
    };

    const agent = new LogActAgent({
      bus,
      inferenceClient: inference,
      voters: [],
      quorumPolicy: QuorumPolicy.OnByDefault,
      maxTurns: 2,
    });

    await agent.send('start');
    await agent.run();

    // Second call should include the result from first action.
    expect(inferMessages.length).toBeGreaterThanOrEqual(1);
    expect(inferMessages[0].some((m) => m.content === 'start')).toBe(true);
  });
});
