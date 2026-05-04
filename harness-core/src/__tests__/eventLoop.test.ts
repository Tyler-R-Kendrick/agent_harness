import { describe, expect, it, vi } from 'vitest';
import {
  AgentLoopActorRegistry,
  AgentLoopEventPublisherRegistry,
  runAgentEventLoop,
  type AgentLoopEvent,
} from '../index.js';

describe('agent event loop', () => {
  it('runs registered event actors, publishes loop events, and exits through workflow state', async () => {
    const events: AgentLoopEvent[] = [];
    const publishers = new AgentLoopEventPublisherRegistry();
    publishers.register({
      id: 'collector',
      publish: (event) => {
        events.push(event);
      },
    });
    const actors = new AgentLoopActorRegistry();
    const tick = vi.fn(() => ({
      event: { type: 'loop.exit', payload: { reason: 'done' } },
      output: 'finished',
    }));
    actors.register({ id: 'tick-agent', event: 'loop.tick', run: tick });

    const result = await runAgentEventLoop({
      id: 'basic-loop',
      initial: 'running',
      states: {
        running: {
          events: [{ type: 'loop.tick' }],
          on: { 'loop.exit': 'done' },
        },
        done: { type: 'final' },
      },
    }, { actors, publishers, runId: 'run-1' });

    expect(result).toEqual({
      workflowId: 'basic-loop',
      runId: 'run-1',
      finalState: 'done',
      transitions: 1,
      dispatchedEvents: [{ type: 'loop.exit', payload: { reason: 'done' } }],
    });
    expect(tick).toHaveBeenCalledOnce();
    expect(events.map((event) => event.type)).toEqual([
      'agent-loop.workflow.started',
      'agent-loop.state.entered',
      'loop.tick',
      'agent-loop.xstate.snapshot',
      'agent-loop.actor.started',
      'agent-loop.actor.completed',
      'agent-loop.xstate.snapshot',
      'agent-loop.event.dispatched',
      'agent-loop.state.exited',
      'agent-loop.workflow.completed',
    ]);
    expect(events.find((event) => event.type === 'agent-loop.actor.completed')).toMatchObject({
      workflowId: 'basic-loop',
      runId: 'run-1',
      state: 'running',
      actorId: 'tick-agent',
      payload: { output: 'finished' },
    });
  });

  it('continues and exits loops through serializable event transitions', async () => {
    const actors = new AgentLoopActorRegistry();
    let attempts = 0;
    actors.register({
      id: 'retry-agent',
      event: 'loop.tick',
      run: () => {
        attempts += 1;
        return { event: { type: attempts === 1 ? 'loop.continue' : 'loop.exit' } };
      },
    });

    const result = await runAgentEventLoop({
      id: 'retry-loop',
      initial: 'running',
      states: {
        running: {
          events: [{ type: 'loop.tick' }],
          on: { 'loop.continue': 'running', 'loop.exit': 'done' },
        },
        done: { type: 'final' },
      },
    }, { actors, runId: 'run-retry' });

    expect(result.finalState).toBe('done');
    expect(result.transitions).toBe(2);
    expect(result.dispatchedEvents.map((event) => event.type)).toEqual(['loop.continue', 'loop.exit']);
  });

  it('supports parallel event actors and parent metadata for future subagents', async () => {
    const events: AgentLoopEvent[] = [];
    const publishers = new AgentLoopEventPublisherRegistry();
    publishers.register({ id: 'collector', publish: (event) => { events.push(event); } });
    const actors = new AgentLoopActorRegistry();
    const calls: string[] = [];

    actors.register({
      id: 'child-agent',
      event: 'child.run',
      run: ({ actorId, parentActorId, input }) => {
        calls.push(`${actorId}:${parentActorId}:${String(input)}`);
        return { output: 'child-output' };
      },
    });
    actors.register({
      id: 'planner',
      event: 'loop.plan',
      run: async ({ runSubagent }) => {
        const child = await runSubagent('child-agent', 'subtask');
        calls.push(`planner:${String(child.output)}`);
        return { output: 'planned' };
      },
    });
    actors.register({
      id: 'executor',
      event: 'loop.plan',
      run: () => {
        calls.push('executor');
        return { event: { type: 'loop.exit' }, output: 'executed' };
      },
    });

    const result = await runAgentEventLoop({
      id: 'parallel-loop',
      initial: 'planning',
      states: {
        planning: {
          events: [{ type: 'loop.plan', mode: 'parallel' }],
          on: { 'loop.exit': 'done' },
        },
        done: { type: 'final' },
      },
    }, { actors, publishers, runId: 'run-parallel' });

    expect(result.finalState).toBe('done');
    expect(calls).toEqual(expect.arrayContaining([
      'child-agent:planner:subtask',
      'planner:child-output',
      'executor',
    ]));
    expect(events).toContainEqual(expect.objectContaining({
      type: 'agent-loop.actor.started',
      actorId: 'child-agent',
      parentActorId: 'planner',
    }));
  });

  it('passes full actor context, supports actor-published events, and accepts explicit actor ids', async () => {
    const events: AgentLoopEvent[] = [];
    const signal = new AbortController().signal;
    const publishers = new AgentLoopEventPublisherRegistry();
    publishers.register({ id: 'collector', publish: (event) => { events.push(event); } });
    const actors = new AgentLoopActorRegistry();

    actors.register({
      id: 'void-agent',
      event: 'loop.tick',
      run: async ({ actorId, eventType, input, runId, signal: actorSignal, publish }) => {
        expect(actorId).toBe('void-agent');
        expect(eventType).toBe('loop.tick');
        expect(input).toEqual({ value: 1 });
        expect(runId).toBe('context-loop:run');
        expect(actorSignal).toBe(signal);
        await publish('loop.observed', { ok: true });
      },
    });
    actors.register({
      id: 'exit-agent',
      event: 'loop.tick',
      run: () => ({ event: { type: 'loop.exit' } }),
    });

    const result = await runAgentEventLoop({
      id: 'context-loop',
      initial: 'running',
      states: {
        running: {
          events: [{ type: 'loop.tick', actorIds: ['void-agent', 'exit-agent'], input: { value: 1 } }],
          on: { 'loop.exit': 'done' },
        },
        done: { type: 'final' },
      },
    }, { actors, publishers, signal });

    expect(result.runId).toBe('context-loop:run');
    expect(events).toContainEqual(expect.objectContaining({
      type: 'loop.observed',
      actorId: 'void-agent',
      payload: { ok: true },
    }));
  });

  it('publishes actor failure events, including unknown subagent failures', async () => {
    const events: AgentLoopEvent[] = [];
    const publishers = new AgentLoopEventPublisherRegistry();
    publishers.register({ id: 'collector', publish: (event) => { events.push(event); } });
    const actors = new AgentLoopActorRegistry();
    actors.register({
      id: 'parent',
      event: 'loop.tick',
      run: ({ runSubagent }) => runSubagent('missing-child'),
    });

    await expect(runAgentEventLoop({
      id: 'failing-loop',
      initial: 'running',
      states: {
        running: { events: [{ type: 'loop.tick' }], on: { 'loop.exit': 'done' } },
        done: { type: 'final' },
      },
    }, { actors, publishers })).rejects.toThrow(/unknown subagent/i);

    expect(events).toContainEqual(expect.objectContaining({
      type: 'agent-loop.actor.failed',
      actorId: 'parent',
    }));
  });

  it('rejects duplicate registrations and malformed workflows', async () => {
    const actors = new AgentLoopActorRegistry();
    actors.register({ id: 'one', event: 'loop.tick', run: () => ({ event: { type: 'loop.exit' } }) });
    expect(() => actors.register({ id: 'one', event: 'loop.other', run: () => undefined })).toThrow(/actor already registered/i);
    expect(actors.get('one')?.id).toBe('one');
    expect(actors.forEvent('loop.tick').map((actor) => actor.id)).toEqual(['one']);
    expect(actors.list().map((actor) => actor.id)).toEqual(['one']);

    const publishers = new AgentLoopEventPublisherRegistry();
    publishers.register({ id: 'events', publish: () => undefined });
    expect(() => publishers.register({ id: 'events', publish: () => undefined })).toThrow(/publisher already registered/i);
    expect(publishers.get('events')?.id).toBe('events');
    expect(publishers.list().map((publisher) => publisher.id)).toEqual(['events']);

    await expect(runAgentEventLoop({
      id: 'missing-state',
      initial: 'unknown',
      states: { done: { type: 'final' } },
    }, { actors })).rejects.toThrow(/unknown workflow state/i);

    await expect(runAgentEventLoop({
      id: 'missing-actor',
      initial: 'running',
      states: {
        running: { events: [{ type: 'loop.unhandled' }], on: { 'loop.exit': 'done' } },
        done: { type: 'final' },
      },
    }, { actors })).rejects.toThrow(/no actors registered/i);

    const idleActors = new AgentLoopActorRegistry();
    idleActors.register({ id: 'idle', event: 'loop.idle', run: () => undefined });
    await expect(runAgentEventLoop({
      id: 'idle-loop',
      initial: 'running',
      states: {
        running: { events: [{ type: 'loop.idle' }], on: { 'loop.exit': 'done' } },
        done: { type: 'final' },
      },
    }, { actors: idleActors })).rejects.toThrow(/no event dispatched/i);

    await expect(runAgentEventLoop({
      id: 'empty-loop',
      initial: 'running',
      states: {
        running: { on: { 'loop.exit': 'done' } },
        done: { type: 'final' },
      },
    }, { actors })).rejects.toThrow(/no event dispatched/i);

    await expect(runAgentEventLoop({
      id: 'parallel-idle-loop',
      initial: 'running',
      states: {
        running: { events: [{ type: 'loop.idle', mode: 'parallel' }], on: { 'loop.exit': 'done' } },
        done: { type: 'final' },
      },
    }, { actors: idleActors })).rejects.toThrow(/no event dispatched/i);

    await expect(runAgentEventLoop({
      id: 'missing-transition',
      initial: 'running',
      states: {
        running: { events: [{ type: 'loop.tick' }], on: { 'loop.other': 'done' } },
        done: { type: 'final' },
      },
    }, { actors })).rejects.toThrow(/no transition/i);

    await expect(runAgentEventLoop({
      id: 'max-loop',
      initial: 'running',
      states: {
        running: { events: [{ type: 'loop.tick' }], on: { 'loop.exit': 'running' } },
      },
    }, { actors, maxTransitions: 1 })).rejects.toThrow(/exceeded 1 transition/i);
  });

  it('publishes agent-loop.workflow.failed before rethrowing when a state actor throws', async () => {
    const events: AgentLoopEvent[] = [];
    const publishers = new AgentLoopEventPublisherRegistry();
    publishers.register({ id: 'collector', publish: (event) => { events.push(event); } });
    const actors = new AgentLoopActorRegistry();
    actors.register({
      id: 'throwing-agent',
      event: 'loop.tick',
      run: () => { throw new Error('actor blew up'); },
    });

    await expect(runAgentEventLoop({
      id: 'throwing-loop',
      initial: 'running',
      states: {
        running: { events: [{ type: 'loop.tick' }], on: { 'loop.exit': 'done' } },
        done: { type: 'final' },
      },
    }, { actors, publishers })).rejects.toThrow('actor blew up');

    expect(events).toContainEqual(expect.objectContaining({ type: 'agent-loop.workflow.failed' }));
  });

  it('stops executing subsequent invocations once the first dispatch event is found', async () => {
    const sideEffects: string[] = [];
    const actors = new AgentLoopActorRegistry();
    actors.register({
      id: 'first-agent',
      event: 'loop.first',
      run: () => {
        sideEffects.push('first');
        return { event: { type: 'loop.exit' } };
      },
    });
    actors.register({
      id: 'second-agent',
      event: 'loop.second',
      run: () => {
        sideEffects.push('second');
        return { event: { type: 'loop.ignored' } };
      },
    });

    const result = await runAgentEventLoop({
      id: 'multi-invocation-loop',
      initial: 'running',
      states: {
        running: {
          events: [
            { type: 'loop.first', actorIds: ['first-agent'] },
            { type: 'loop.second', actorIds: ['second-agent'] },
          ],
          on: { 'loop.exit': 'done' },
        },
        done: { type: 'final' },
      },
    }, { actors });

    expect(result.finalState).toBe('done');
    expect(sideEffects).toEqual(['first']);
    expect(sideEffects).not.toContain('second');
  });

  it('throws when multiple parallel actors return conflicting dispatch events', async () => {
    const actors = new AgentLoopActorRegistry();
    actors.register({
      id: 'actor-a',
      event: 'loop.race',
      run: () => ({ event: { type: 'loop.exit-a' } }),
    });
    actors.register({
      id: 'actor-b',
      event: 'loop.race',
      run: () => ({ event: { type: 'loop.exit-b' } }),
    });

    await expect(runAgentEventLoop({
      id: 'conflict-loop',
      initial: 'running',
      states: {
        running: {
          events: [{ type: 'loop.race', actorIds: ['actor-a', 'actor-b'], mode: 'parallel' }],
          on: { 'loop.exit-a': 'done' },
        },
        done: { type: 'final' },
      },
    }, { actors })).rejects.toThrow(/conflicting events in parallel/i);
  });
});
