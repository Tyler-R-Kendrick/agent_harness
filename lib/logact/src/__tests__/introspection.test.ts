import { describe, it, expect } from 'vitest';
import {
  buildExecutionSummary,
  getResults,
  getAbortedIntents,
} from '../introspection.js';
import { InMemoryAgentBus } from '../agentBus.js';
import { PayloadType } from '../types.js';

async function buildTestBus() {
  const bus = new InMemoryAgentBus();
  await bus.append({ type: PayloadType.Mail, from: 'user', content: 'do something' });
  await bus.append({ type: PayloadType.InfIn, messages: [{ role: 'user', content: 'do something' }] });
  await bus.append({ type: PayloadType.InfOut, text: 'print hello' });
  await bus.append({ type: PayloadType.Intent, intentId: 'i1', action: 'print hello' });
  await bus.append({ type: PayloadType.Vote, intentId: 'i1', voterId: 'v1', approve: true });
  await bus.append({ type: PayloadType.Commit, intentId: 'i1' });
  await bus.append({ type: PayloadType.Result, intentId: 'i1', output: 'hello' });

  // A second intent that gets aborted.
  await bus.append({ type: PayloadType.Intent, intentId: 'i2', action: 'rm -rf /' });
  await bus.append({ type: PayloadType.Vote, intentId: 'i2', voterId: 'v1', approve: false, reason: 'unsafe' });
  await bus.append({ type: PayloadType.Abort, intentId: 'i2', reason: 'unsafe' });

  return bus;
}

describe('buildExecutionSummary', () => {
  it('includes mail, intent, vote, commit, result, and abort lines', async () => {
    const bus = await buildTestBus();
    const summary = await buildExecutionSummary(bus);
    expect(summary).toContain('MAIL');
    expect(summary).toContain('INTENT(i1)');
    expect(summary).toContain('VOTE(i1)');
    expect(summary).toContain('COMMIT(i1)');
    expect(summary).toContain('RESULT(i1)');
    expect(summary).toContain('ABORT(i2)');
  });

  it('skips InfIn, InfOut, Policy entries', async () => {
    const bus = await buildTestBus();
    await bus.append({ type: PayloadType.Policy, target: 'quorum', value: 'first_voter' });
    const summary = await buildExecutionSummary(bus);
    expect(summary).not.toContain('InfIn');
    expect(summary).not.toContain('InfOut');
    expect(summary).not.toContain('Policy');
  });

  it('includes reason in abort lines when present', async () => {
    const bus = await buildTestBus();
    const summary = await buildExecutionSummary(bus);
    expect(summary).toContain('reason="unsafe"');
  });

  it('includes rejection reason in vote lines', async () => {
    const bus = await buildTestBus();
    const summary = await buildExecutionSummary(bus);
    expect(summary).toContain('reason="unsafe"');
  });

  it('handles abort without reason', async () => {
    const bus = new InMemoryAgentBus();
    await bus.append({ type: PayloadType.Abort, intentId: 'i3' });
    const summary = await buildExecutionSummary(bus);
    expect(summary).toContain('ABORT(i3)');
    expect(summary).not.toContain('reason=');
  });

  it('shows ERROR prefix for result payloads that have an error', async () => {
    const bus = new InMemoryAgentBus();
    await bus.append({ type: PayloadType.Result, intentId: 'i4', output: '', error: 'exec failed' });
    const summary = await buildExecutionSummary(bus);
    expect(summary).toContain('ERROR exec failed');
  });
});

describe('getResults', () => {
  it('returns all result payloads', async () => {
    const bus = await buildTestBus();
    const results = await getResults(bus);
    expect(results).toHaveLength(1);
    expect(results[0].output).toBe('hello');
    expect(results[0].intentId).toBe('i1');
  });

  it('returns empty array when no results', async () => {
    const bus = new InMemoryAgentBus();
    expect(await getResults(bus)).toHaveLength(0);
  });
});

describe('getAbortedIntents', () => {
  it('returns aborted intent-abort pairs', async () => {
    const bus = await buildTestBus();
    const aborted = await getAbortedIntents(bus);
    expect(aborted).toHaveLength(1);
    expect(aborted[0].intent.intentId).toBe('i2');
    expect(aborted[0].abort.reason).toBe('unsafe');
  });

  it('ignores abort entries with no matching intent', async () => {
    const bus = new InMemoryAgentBus();
    await bus.append({ type: PayloadType.Abort, intentId: 'ghost' });
    const aborted = await getAbortedIntents(bus);
    expect(aborted).toHaveLength(0);
  });
});
