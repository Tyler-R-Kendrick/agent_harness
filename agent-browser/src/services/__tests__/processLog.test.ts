import { describe, expect, it, vi } from 'vitest';
import { PayloadType } from 'logact';
import type { Entry } from 'logact';
import { ProcessLog, appendBusEntry, entryToProcessAppend } from '../processLog';

describe('ProcessLog', () => {
  it('appends entries with monotonic positions and notifies subscribers', () => {
    const log = new ProcessLog();
    const seen: number[] = [];
    const unsubscribe = log.subscribe((snapshot) => seen.push(snapshot.length));

    const a = log.append({ id: 'a', kind: 'reasoning', actor: 'coordinator', summary: 'first' });
    const b = log.append({ id: 'b', kind: 'reasoning', actor: 'coordinator', summary: 'second' });

    expect(a.position).toBe(0);
    expect(b.position).toBe(1);
    expect(seen).toEqual([1, 2]);
    expect(log.snapshot()).toHaveLength(2);

    unsubscribe();
    log.append({ id: 'c', kind: 'reasoning', actor: 'coordinator', summary: 'third' });
    expect(seen).toEqual([1, 2]);
  });

  it('supports default status, optional fields, and ts override', () => {
    const log = new ProcessLog();
    const entry = log.append({
      id: 'a',
      kind: 'stage-start',
      actor: 'coordinator',
      summary: 'planning',
      transcript: 'tokens',
      payload: { hello: 'world' },
      parentId: 'root',
      branchId: 'main',
      status: 'active',
      ts: 1234,
      timeoutMs: 60_000,
    });
    expect(entry.status).toBe('active');
    expect(entry.transcript).toBe('tokens');
    expect(entry.payload).toEqual({ hello: 'world' });
    expect(entry.parentId).toBe('root');
    expect(entry.branchId).toBe('main');
    expect(entry.ts).toBe(1234);
    expect(entry.timeoutMs).toBe(60_000);
  });

  it('updates existing entries in place and stamps endedAt on done', () => {
    const log = new ProcessLog();
    log.append({ id: 'a', kind: 'reasoning', actor: 'coordinator', summary: 'short', status: 'active' });
    expect(log.update('a', { transcript: 'tok1' })).toBe(true);
    expect(log.snapshot()[0].transcript).toBe('tok1');
    expect(log.snapshot()[0].endedAt).toBeUndefined();

    expect(log.update('a', { status: 'done' })).toBe(true);
    expect(log.snapshot()[0].status).toBe('done');
    expect(log.snapshot()[0].endedAt).toBeTypeOf('number');

    expect(log.update('missing', { summary: 'x' })).toBe(false);
  });

  it('preserves an explicit endedAt when provided in patch', () => {
    const log = new ProcessLog();
    log.append({ id: 'a', kind: 'reasoning', actor: 'x', summary: 'y', status: 'active' });
    log.update('a', { status: 'done', endedAt: 9999 });
    expect(log.snapshot()[0].endedAt).toBe(9999);
  });

  it('exposes has() for id lookup', () => {
    const log = new ProcessLog();
    log.append({ id: 'a', kind: 'reasoning', actor: 'x', summary: 'y' });
    expect(log.has('a')).toBe(true);
    expect(log.has('b')).toBe(false);
  });

  it('snapshot returns an immutable copy', () => {
    const log = new ProcessLog();
    log.append({ id: 'a', kind: 'reasoning', actor: 'x', summary: 'y' });
    const snap = log.snapshot();
    snap[0].summary = 'mutated';
    expect(log.snapshot()[0].summary).toBe('y');
  });
});

describe('entryToProcessAppend', () => {
  const buildEntry = <T>(payload: T): Entry => ({
    position: 7,
    realtimeTs: 5000,
    payload: payload as never,
  });

  it('translates Mail payloads', () => {
    const append = entryToProcessAppend(
      buildEntry({ type: PayloadType.Mail, from: 'user', content: 'hi there' }),
    );
    expect(append).toMatchObject({
      kind: 'mail',
      actor: 'user',
      summary: 'Mail · user',
      transcript: 'hi there',
      branchId: 'bus',
      ts: 5000,
      id: 'bus-7',
    });
  });

  it('translates InfIn / InfOut / Intent payloads', () => {
    const inf = entryToProcessAppend(
      buildEntry({
        type: PayloadType.InfIn,
        messages: [
          { role: 'user' as const, content: 'q' },
          { role: 'assistant' as const, content: 'a' },
        ],
      }),
    );
    expect(inf.kind).toBe('inf-in');
    expect(inf.summary).toBe('InfIn · 2 messages');
    expect(inf.transcript).toContain('user: q');

    const out = entryToProcessAppend(buildEntry({ type: PayloadType.InfOut, text: 'reply' }));
    expect(out.kind).toBe('inf-out');
    expect(out.transcript).toBe('reply');

    const intent = entryToProcessAppend(
      buildEntry({ type: PayloadType.Intent, intentId: 'i1', action: 'do thing' }),
    );
    expect(intent.kind).toBe('intent');
    expect(intent.summary).toBe('Intent · i1');
    expect(intent.transcript).toBe('do thing');
  });

  it('uses singular wording for one-message InfIn', () => {
    const inf = entryToProcessAppend(
      buildEntry({
        type: PayloadType.InfIn,
        messages: [{ role: 'user' as const, content: 'q' }],
      }),
    );
    expect(inf.summary).toBe('InfIn · 1 message');
  });

  it('translates Vote payloads with thought/reason fallback', () => {
    const withThought = entryToProcessAppend(
      buildEntry({
        type: PayloadType.Vote,
        intentId: 'i1',
        voterId: 'v1',
        approve: true,
        thought: 'looks good',
      }),
    );
    expect(withThought.kind).toBe('vote');
    expect(withThought.actor).toBe('voter:v1');
    expect(withThought.summary).toBe('Vote · v1 ✓');
    expect(withThought.transcript).toBe('looks good');

    const withReason = entryToProcessAppend(
      buildEntry({
        type: PayloadType.Vote,
        intentId: 'i1',
        voterId: 'v2',
        approve: false,
        reason: 'bad',
      }),
    );
    expect(withReason.summary).toBe('Vote · v2 ✗');
    expect(withReason.transcript).toBe('bad');

    const noText = entryToProcessAppend(
      buildEntry({ type: PayloadType.Vote, intentId: 'i1', voterId: 'v3', approve: true }),
    );
    expect(noText.transcript).toBe('approved');

    const rejectedNoText = entryToProcessAppend(
      buildEntry({ type: PayloadType.Vote, intentId: 'i1', voterId: 'v4', approve: false }),
    );
    expect(rejectedNoText.transcript).toBe('rejected');
  });

  it('translates Commit, Abort, Result, Completion, Policy', () => {
    const commit = entryToProcessAppend(buildEntry({ type: PayloadType.Commit, intentId: 'i1' }));
    expect(commit.kind).toBe('commit');
    expect(commit.summary).toBe('Commit · i1');

    const abort = entryToProcessAppend(
      buildEntry({ type: PayloadType.Abort, intentId: 'i1', reason: 'nope' }),
    );
    expect(abort.kind).toBe('abort');
    expect(abort.transcript).toBe('nope');

    const ok = entryToProcessAppend(
      buildEntry({ type: PayloadType.Result, intentId: 'i1', output: 'done' }),
    );
    expect(ok.kind).toBe('result');
    expect(ok.transcript).toBe('done');

    const errResult = entryToProcessAppend(
      buildEntry({ type: PayloadType.Result, intentId: 'i1', output: 'partial', error: 'boom' }),
    );
    expect(errResult.transcript).toContain('error: boom');
    expect(errResult.transcript).toContain('partial');

    const compDone = entryToProcessAppend(
      buildEntry({ type: PayloadType.Completion, intentId: 'i1', done: true, feedback: 'ok' }),
    );
    expect(compDone.summary).toBe('Completion · i1 ✓');
    expect(compDone.transcript).toBe('ok');

    const compNotDone = entryToProcessAppend(
      buildEntry({ type: PayloadType.Completion, intentId: 'i1', done: false }),
    );
    expect(compNotDone.summary).toBe('Completion · i1');
    expect(compNotDone.transcript).toBeUndefined();

    const policy = entryToProcessAppend(
      buildEntry({ type: PayloadType.Policy, target: 'quorum', value: { kind: 'AND' } }),
    );
    expect(policy.kind).toBe('policy');
    expect(policy.summary).toBe('Policy · quorum');
    expect(policy.transcript).toContain('"AND"');
  });
});

describe('appendBusEntry', () => {
  it('appends a translated bus entry to the log', () => {
    const log = new ProcessLog();
    const listener = vi.fn();
    log.subscribe(listener);
    const entry = appendBusEntry(log, {
      position: 3,
      realtimeTs: 99,
      payload: { type: PayloadType.Commit, intentId: 'i9' },
    });
    expect(entry.kind).toBe('commit');
    expect(entry.id).toBe('bus-3');
    expect(log.snapshot()).toHaveLength(1);
    expect(listener).toHaveBeenCalled();
  });
});
