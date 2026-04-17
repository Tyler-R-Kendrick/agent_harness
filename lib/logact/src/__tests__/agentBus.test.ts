import { describe, it, expect } from 'vitest';
import { InMemoryAgentBus } from '../agentBus.js';
import { PayloadType } from '../types.js';

describe('InMemoryAgentBus', () => {
  it('starts with tail = 0', async () => {
    const bus = new InMemoryAgentBus();
    expect(await bus.tail()).toBe(0);
  });

  it('appends and returns sequential positions', async () => {
    const bus = new InMemoryAgentBus();
    const p0 = await bus.append({ type: PayloadType.Mail, from: 'user', content: 'hello' });
    const p1 = await bus.append({ type: PayloadType.Mail, from: 'user', content: 'world' });
    expect(p0).toBe(0);
    expect(p1).toBe(1);
    expect(await bus.tail()).toBe(2);
  });

  it('reads correct slice [start, end)', async () => {
    const bus = new InMemoryAgentBus();
    await bus.append({ type: PayloadType.Mail, from: 'a', content: '0' });
    await bus.append({ type: PayloadType.Mail, from: 'a', content: '1' });
    await bus.append({ type: PayloadType.Mail, from: 'a', content: '2' });

    const entries = await bus.read(1, 3);
    expect(entries).toHaveLength(2);
    expect((entries[0].payload as { content: string }).content).toBe('1');
    expect((entries[1].payload as { content: string }).content).toBe('2');
  });

  it('poll resolves immediately when matching entries already exist', async () => {
    const bus = new InMemoryAgentBus();
    await bus.append({ type: PayloadType.Mail, from: 'u', content: 'hey' });
    const results = await bus.poll(0, [PayloadType.Mail]);
    expect(results).toHaveLength(1);
    expect(results[0].payload.type).toBe(PayloadType.Mail);
  });

  it('poll waits and resolves when a matching entry is appended later', async () => {
    const bus = new InMemoryAgentBus();

    const pollPromise = bus.poll(0, [PayloadType.Result]);

    // Append a non-matching entry first, then the matching one.
    await bus.append({ type: PayloadType.Mail, from: 'u', content: 'nope' });
    await bus.append({
      type: PayloadType.Result,
      intentId: 'i1',
      output: 'done',
    });

    const entries = await pollPromise;
    expect(entries.some((e) => e.payload.type === PayloadType.Result)).toBe(true);
  });

  it('poll with start offset only returns entries at or after start', async () => {
    const bus = new InMemoryAgentBus();
    await bus.append({ type: PayloadType.Mail, from: 'u', content: 'first' });
    await bus.append({ type: PayloadType.Mail, from: 'u', content: 'second' });

    const entries = await bus.poll(1, [PayloadType.Mail]);
    expect(entries).toHaveLength(1);
    expect((entries[0].payload as { content: string }).content).toBe('second');
  });

  it('sets realtimeTs on each entry', async () => {
    const before = Date.now();
    const bus = new InMemoryAgentBus();
    await bus.append({ type: PayloadType.Mail, from: 'u', content: 'ts test' });
    const after = Date.now();
    const entries = await bus.read(0, 1);
    expect(entries[0].realtimeTs).toBeGreaterThanOrEqual(before);
    expect(entries[0].realtimeTs).toBeLessThanOrEqual(after);
  });
});
