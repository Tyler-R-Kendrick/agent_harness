import { describe, expect, it, vi } from 'vitest';
import {
  HarnessAgent,
  createActorMessageEvent,
  normalizeSession,
  resolveDefaultMessageActor,
  runHarnessLoop,
  type ActorMessageEvent,
  type HarnessEvent,
  type HarnessMessage,
} from '../agent.js';

describe('runHarnessLoop', () => {
  it('emits Pi-style lifecycle events around prompts, turns, and agent completion', async () => {
    const events: Array<HarnessEvent<HarnessMessage>['type']> = [];
    const seenContextLengths: number[] = [];
    const context = {
      messages: [{ role: 'system', content: 'system prompt', timestamp: 1 }],
    };

    const newMessages = await runHarnessLoop(
      [{ role: 'user', content: 'hello', timestamp: 2 }],
      context,
      {
        transformContext: async (messages) => [
          ...messages,
          { role: 'system', content: 'external context', timestamp: 3 },
        ],
        runTurn: async ({ messages }) => {
          seenContextLengths.push(messages.length);
          return { role: 'assistant', content: `saw ${messages.length}`, timestamp: 4 };
        },
      },
      async (event) => {
        events.push(event.type);
      },
    );

    expect(seenContextLengths).toEqual([3]);
    expect(events).toEqual([
      'agent_start',
      'turn_start',
      'message_start',
      'message_end',
      'message_start',
      'message_end',
      'turn_end',
      'agent_end',
    ]);
    expect(newMessages.map((message) => message.content)).toEqual(['hello', 'saw 3']);
    expect(context.messages.map((message) => message.content)).toEqual(['system prompt', 'hello', 'saw 3']);
  });

  it('injects steering before follow-up messages', async () => {
    const turnInputs: string[] = [];
    let steeringDrains = 0;
    let followUpDrains = 0;

    const newMessages = await runHarnessLoop(
      [{ role: 'user', content: 'initial', timestamp: 1 }],
      { messages: [] },
      {
        runTurn: async ({ messages }) => {
          turnInputs.push(messages.at(-1)?.content ?? '');
          return { role: 'assistant', content: `answer:${messages.at(-1)?.content ?? ''}`, timestamp: Date.now() };
        },
        getSteeringMessages: async () => {
          steeringDrains += 1;
          return steeringDrains === 2
            ? [{ role: 'user', content: 'steer', timestamp: 2 }]
            : [];
        },
        getFollowUpMessages: async () => {
          followUpDrains += 1;
          return followUpDrains === 1
            ? [{ role: 'user', content: 'follow-up', timestamp: 3 }]
            : [];
        },
      },
      async () => undefined,
    );

    expect(turnInputs).toEqual(['initial', 'steer', 'follow-up']);
    expect(newMessages.map((message) => message.content)).toEqual([
      'initial',
      'answer:initial',
      'steer',
      'answer:steer',
      'follow-up',
      'answer:follow-up',
    ]);
  });
});

describe('HarnessAgent', () => {
  it('normalizes sessions and resolves default actor message metadata', () => {
    const session = normalizeSession({ id: 'session-meta', metadata: { tenant: 'acme' } });
    const defaultSession = normalizeSession();
    const fallbackEvent = createActorMessageEvent(
      'actor.message',
      { content: 'without timestamp' },
      defaultSession,
      resolveDefaultMessageActor,
      0,
      { kind: 'unit-test' },
    );

    expect(session).toEqual({ id: 'session-meta', mode: 'local', metadata: { tenant: 'acme' } });
    expect(resolveDefaultMessageActor({ role: 'assistant' }, session)).toEqual({
      id: 'agent',
      role: 'agent',
      sessionId: 'session-meta',
    });
    expect(resolveDefaultMessageActor({ role: 'system' }, session)).toEqual({
      id: 'system',
      role: 'system',
      sessionId: 'session-meta',
    });
    expect(resolveDefaultMessageActor({ role: 'user' }, session)).toEqual({
      id: 'user',
      role: 'user',
      sessionId: 'session-meta',
    });
    expect(fallbackEvent).toMatchObject({
      eventId: 'local:actor.message:0',
      sessionId: 'local',
      source: { kind: 'unit-test' },
      actor: { id: 'user', role: 'user', sessionId: 'local' },
    });
    expect(fallbackEvent.timestamp).toBeGreaterThan(0);
  });

  it('emits actor message events with session and actor metadata', async () => {
    const messageEvents: Array<ActorMessageEvent<HarnessMessage>> = [];
    const agent = new HarnessAgent<HarnessMessage>({
      session: { id: 'session-1' },
      createUserMessage: (content) => ({ role: 'user', content, timestamp: 1 }),
      resolveMessageActor: (message, session) => ({
        id: message.role === 'assistant' ? 'agent-1' : 'user-device-a',
        role: message.role === 'assistant' ? 'agent' : 'user',
        sessionId: session.id,
      }),
      runTurn: async () => ({ role: 'assistant', content: 'reply', timestamp: 2 }),
    });

    agent.subscribe((event) => {
      if (event.type === 'message_start' || event.type === 'message_end') {
        messageEvents.push(event);
      }
    });

    await agent.prompt('hello');

    expect(messageEvents).toHaveLength(4);
    expect(messageEvents.map((event) => event.sessionId)).toEqual([
      'session-1',
      'session-1',
      'session-1',
      'session-1',
    ]);
    expect(messageEvents[0]).toMatchObject({
      type: 'message_start',
      actor: { id: 'user-device-a', role: 'user', sessionId: 'session-1' },
      message: { role: 'user', content: 'hello' },
    });
    expect(messageEvents[2]).toMatchObject({
      type: 'message_start',
      actor: { id: 'agent-1', role: 'agent', sessionId: 'session-1' },
      message: { role: 'assistant', content: 'reply' },
    });
    expect(JSON.parse(JSON.stringify(messageEvents[0]))).toEqual(messageEvents[0]);
  });

  it('owns state, queues follow-ups, and awaits event subscribers before becoming idle', async () => {
    const listener = vi.fn<() => Promise<void>>(async () => undefined);
    const agent = new HarnessAgent<HarnessMessage>({
      createUserMessage: (content) => ({ role: 'user', content, timestamp: 1 }),
      runTurn: async ({ messages }) => ({
        role: 'assistant',
        content: `assistant:${messages.at(-1)?.content ?? ''}`,
        timestamp: 2,
      }),
    });
    const unsubscribe = agent.subscribe(listener);

    agent.followUp({ role: 'user', content: 'next', timestamp: 3 });
    await agent.prompt('start');
    unsubscribe();
    await agent.waitForIdle();

    expect(agent.state.isStreaming).toBe(false);
    expect(agent.state.messages.map((message) => message.content)).toEqual([
      'start',
      'assistant:start',
      'next',
      'assistant:next',
    ]);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'agent_end' }), expect.any(AbortSignal));
  });

  it('rejects concurrent prompts and exposes the active abort signal', async () => {
    let releaseTurn!: () => void;
    const agent = new HarnessAgent<HarnessMessage>({
      createUserMessage: (content) => ({ role: 'user', content, timestamp: 1 }),
      runTurn: async (_context, signal) => {
        expect(signal?.aborted).toBe(false);
        await new Promise<void>((resolve) => {
          releaseTurn = resolve;
        });
        return { role: 'assistant', content: signal?.aborted ? 'aborted' : 'finished', timestamp: 2 };
      },
    });

    const promptPromise = agent.prompt('start');
    await expect(agent.prompt('again')).rejects.toThrow('already processing');
    expect(agent.signal).toBeInstanceOf(AbortSignal);

    agent.abort();
    releaseTurn();
    await promptPromise;

    expect(agent.state.errorMessage).toBe('aborted');
    expect(agent.state.messages.at(-1)?.content).toBe('aborted');
  });

  it('continues from queued messages when the transcript ends with an assistant message and resets state', async () => {
    const agent = new HarnessAgent<HarnessMessage>({
      initialState: {
        messages: [{ role: 'assistant', content: 'previous', timestamp: 1 }],
      },
      createUserMessage: (content) => ({ role: 'user', content, timestamp: 2 }),
      runTurn: async ({ messages }) => ({ role: 'assistant', content: `reply:${messages.at(-1)?.content ?? ''}`, timestamp: 3 }),
    });

    agent.steer({ role: 'user', content: 'steered', timestamp: 4 });
    await agent.continue();

    expect(agent.state.messages.map((message) => message.content)).toEqual(['previous', 'steered', 'reply:steered']);
    expect(agent.hasQueuedMessages()).toBe(false);

    agent.followUp({ role: 'user', content: 'discard', timestamp: 5 });
    agent.reset();

    expect(agent.state.messages).toEqual([]);
    expect(agent.state.errorMessage).toBeUndefined();
    expect(agent.hasQueuedMessages()).toBe(false);
  });

  it('continues from follow-ups, rejects blocked continuations, and accepts message inputs directly', async () => {
    const makeAgent = (initialMessages: HarnessMessage[] = []) => new HarnessAgent<HarnessMessage>({
      initialState: { messages: initialMessages },
      createUserMessage: (content) => ({ role: 'user', content, timestamp: 1 }),
      runTurn: async ({ messages }) => ({ role: 'assistant', content: `reply:${messages.at(-1)?.content ?? 'empty'}`, timestamp: 2 }),
    });
    const followUpAgent = makeAgent([{ role: 'assistant', content: 'previous', timestamp: 3 }]);

    followUpAgent.followUp({ role: 'user', content: 'queued-follow-up', timestamp: 4 });
    await followUpAgent.continue();

    expect(followUpAgent.state.messages.map((message) => message.content)).toEqual([
      'previous',
      'queued-follow-up',
      'reply:queued-follow-up',
    ]);

    await expect(makeAgent([{ role: 'assistant', content: 'stuck', timestamp: 5 }]).continue())
      .rejects.toThrow('Cannot continue');

    const userEndedAgent = makeAgent([{ role: 'user', content: 'resume', timestamp: 6 }]);
    await userEndedAgent.continue();
    expect(userEndedAgent.state.messages.at(-1)?.content).toBe('reply:resume');

    const directInputAgent = makeAgent();
    directInputAgent.steeringMode = 'all';
    directInputAgent.followUpMode = 'all';
    expect(directInputAgent.steeringMode).toBe('all');
    expect(directInputAgent.followUpMode).toBe('all');

    await directInputAgent.prompt({ role: 'user', content: 'single', timestamp: 7 });
    await directInputAgent.prompt([{ role: 'user', content: 'array', timestamp: 8 }]);

    expect(directInputAgent.state.messages.map((message) => message.content)).toContain('single');
    expect(directInputAgent.state.messages.map((message) => message.content)).toContain('array');
  });

  it('rejects continue while a run is active', async () => {
    let releaseTurn!: () => void;
    const agent = new HarnessAgent<HarnessMessage>({
      createUserMessage: (content) => ({ role: 'user', content, timestamp: 1 }),
      runTurn: async () => {
        await new Promise<void>((resolve) => {
          releaseTurn = resolve;
        });
        return { role: 'assistant', content: 'done', timestamp: 2 };
      },
    });

    const promptPromise = agent.prompt('start');
    await expect(agent.continue()).rejects.toThrow('already processing');
    releaseTurn();
    await promptPromise;
  });
});
