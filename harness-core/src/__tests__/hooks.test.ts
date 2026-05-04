import { describe, expect, it, vi } from 'vitest';
import {
  ACTOR_WORKFLOW_HOOK_EVENTS,
  AGENT_BUS_HOOK_EVENTS,
  AGENT_LOOP_HOOK_EVENTS,
  HarnessHookPolicyError,
  HookRegistry,
  LLM_HOOK_EVENTS,
  appendAgentEvent,
  createCodeHook,
  createAgentBus,
  createSemanticHook,
  hookPointForEvent,
  readAgentBusEntries,
  runActorWorkflow,
  runHarnessLoop,
  type HarnessMessage,
} from '../index.js';
import { PayloadType } from 'logact';

describe('hook event routing', () => {
  it('routes code and semantic hooks through typed llm events', async () => {
    const hooks = new HookRegistry<{ text: string }>();
    const calls: string[] = [];

    hooks.registerMiddleware(createCodeHook<{ text: string }>({
      id: 'llm-policy',
      event: LLM_HOOK_EVENTS.input,
      run: ({ event, payload }) => {
        calls.push(`${event?.type}:${event?.name}:${payload.text}`);
        return { output: 'policy-pass' };
      },
    }));
    hooks.registerMiddleware(createCodeHook<{ toolName: string }>({
      id: 'agent-policy',
      event: ACTOR_WORKFLOW_HOOK_EVENTS.started,
      run: () => {
        calls.push('wrong-event');
      },
    }));
    hooks.registerPipe(createSemanticHook<{ text: string }>({
      id: 'semantic-rewrite',
      event: LLM_HOOK_EVENTS.input,
      prompt: 'Rewrite the user request as a concise task intent.',
      run: ({ payload, semantic }) => ({
        payload: { text: `intent:${payload.text}` },
        output: semantic?.prompt,
      }),
    }));

    const result = await hooks.runEvent(LLM_HOOK_EVENTS.input, { text: 'summarize hooks' });

    expect(result).toEqual({
      payload: { text: 'intent:summarize hooks' },
      stopped: false,
      outputs: [
        { hookId: 'llm-policy', output: 'policy-pass' },
        { hookId: 'semantic-rewrite', output: 'Rewrite the user request as a concise task intent.' },
      ],
    });
    expect(calls).toEqual(['llm:input:summarize hooks']);
    expect(hooks.forEvent(LLM_HOOK_EVENTS.input).map((hook) => [hook.id, hook.format]))
      .toEqual([
        ['llm-policy', 'code'],
        ['semantic-rewrite', 'semantic'],
      ]);
    expect(hookPointForEvent(LLM_HOOK_EVENTS.input)).toBe('llm:input');
  });

  it('runs every middleware policy point in parallel before denying propagation', async () => {
    const hooks = new HookRegistry<{ toolName: string }>();
    const calls: string[] = [];

    hooks.registerMiddleware(createCodeHook<{ toolName: string }>({
      id: 'audit',
      event: LLM_HOOK_EVENTS.toolCall,
      run: async () => {
        calls.push('audit');
        return { output: 'logged' };
      },
    }));
    hooks.registerMiddleware(createCodeHook<{ toolName: string }>({
      id: 'deny-network',
      event: LLM_HOOK_EVENTS.toolCall,
      run: async ({ payload }) => {
        calls.push('deny-network');
        return { pass: false, reason: `blocked:${payload.toolName}`, output: 'denied' };
      },
    }));
    hooks.registerPipe(createCodeHook<{ answer: string }>({
      id: 'skipped-pipe',
      event: LLM_HOOK_EVENTS.toolCall,
      run: () => {
        calls.push('skipped-pipe');
      },
    }));

    await expect(hooks.runEvent(LLM_HOOK_EVENTS.toolCall, { toolName: 'fetch' }))
      .rejects.toMatchObject({
        failures: [{ hookId: 'deny-network', reason: 'blocked:fetch' }],
        outputs: [
          { hookId: 'audit', output: 'logged' },
          { hookId: 'deny-network', output: 'denied' },
        ],
      });
    await expect(hooks.runEvent(LLM_HOOK_EVENTS.toolCall, { toolName: 'fetch' }))
      .rejects.toBeInstanceOf(HarnessHookPolicyError);
    expect(calls).toEqual(['audit', 'deny-network', 'audit', 'deny-network']);
  });

  it('lets pipe hooks mutate outputs sequentially and bubble later handlers', async () => {
    const hooks = new HookRegistry<{ answer: string }>();
    const calls: string[] = [];

    hooks.registerPipe(createCodeHook<{ answer: string }>({
      id: 'trim-output',
      event: LLM_HOOK_EVENTS.output,
      priority: 1,
      run: async ({ payload }) => {
        calls.push('trim-output');
        return { payload: { answer: payload.answer.trim() } };
      },
    }));
    hooks.registerPipe(createCodeHook<{ answer: string }>({
      id: 'bubble-output',
      event: LLM_HOOK_EVENTS.output,
      priority: 2,
      run: ({ payload }) => {
        calls.push(`bubble-output:${payload.answer}`);
        return { bubble: true, output: 'bubbled' };
      },
    }));
    hooks.registerPipe(createCodeHook({
      id: 'after-bubble',
      event: LLM_HOOK_EVENTS.output,
      priority: 3,
      run: () => {
        calls.push('after-bubble');
      },
    }));

    await expect(hooks.runPipesForEvent(LLM_HOOK_EVENTS.output, { answer: '  done  ' }))
      .resolves.toEqual({
        payload: { answer: 'done' },
        stopped: false,
        canceled: false,
        bubbled: true,
        outputs: [{ hookId: 'bubble-output', output: 'bubbled' }],
      });
    expect(calls).toEqual(['trim-output', 'bubble-output:done']);
  });

  it('supports explicit point hooks and rejects unaddressed hook constructors', async () => {
    const hooks = new HookRegistry<string>();

    hooks.registerPipe(createCodeHook({
      id: 'point-hook',
      point: 'custom-point',
      run: ({ payload }) => ({ payload: `${payload}:point` }),
    }));
    hooks.registerMiddleware(createCodeHook({
      id: 'point-deny',
      point: 'blocked-point',
      run: () => ({ pass: false, reason: 'blocked' }),
    }));
    hooks.registerMiddleware(createCodeHook({
      id: 'point-deny-no-reason',
      point: 'blocked-no-reason',
      run: () => ({ pass: false }),
    }));
    hooks.registerPipe(createSemanticHook({
      id: 'semantic-point',
      point: 'semantic-point',
      prompt: 'Improve the input.',
      run: ({ payload, semantic }) => ({ payload: `${payload}:${semantic?.prompt}` }),
    }));

    await expect(hooks.run('custom-point', 'value')).resolves.toEqual({
      payload: 'value:point',
      stopped: false,
      outputs: [],
    });
    await expect(hooks.run('semantic-point', 'value')).resolves.toEqual({
      payload: 'value:Improve the input.',
      stopped: false,
      outputs: [],
    });
    await expect(hooks.run('blocked-point', 'value')).rejects.toBeInstanceOf(HarnessHookPolicyError);
    await expect(hooks.runMiddleware('blocked-no-reason', 'value')).resolves.toEqual({
      payload: 'value',
      outputs: [],
      passed: false,
      failures: [{ hookId: 'point-deny-no-reason' }],
    });
    expect(() => createCodeHook({
      id: 'bad-code',
      run: () => undefined,
    })).toThrow(/event or point/i);
    expect(() => createSemanticHook({
      id: 'bad-semantic',
      prompt: 'Do the thing.',
      run: () => undefined,
    })).toThrow(/event or point/i);
  });

  it('preserves event-run cancellation reasons', async () => {
    const hooks = new HookRegistry<string>();

    hooks.registerPipe(createCodeHook({
      id: 'cancel-with-reason',
      event: LLM_HOOK_EVENTS.output,
      run: () => ({ cancel: true, reason: 'stop-here' }),
    }));

    await expect(hooks.runEvent(LLM_HOOK_EVENTS.output, 'value')).resolves.toEqual({
      payload: 'value',
      stopped: true,
      reason: 'stop-here',
      outputs: [],
    });
  });

  it('fires hooks around every agent loop layer and lets llm hooks transform turn inputs and outputs', async () => {
    const hooks = new HookRegistry();
    const calls: string[] = [];
    const context = {
      messages: [{ role: 'system', content: 'system prompt', timestamp: 1 } satisfies HarnessMessage],
    };

    for (const event of [
      AGENT_LOOP_HOOK_EVENTS.loopStart,
      AGENT_LOOP_HOOK_EVENTS.turnStart,
      AGENT_LOOP_HOOK_EVENTS.messageStart,
      AGENT_LOOP_HOOK_EVENTS.messageEnd,
      AGENT_LOOP_HOOK_EVENTS.turnEnd,
      AGENT_LOOP_HOOK_EVENTS.loopEnd,
    ]) {
      hooks.registerMiddleware(createCodeHook({
        id: `observe-${event.name}`,
        event,
        run: ({ event: hookEvent }) => {
          calls.push(`${hookEvent?.type}:${hookEvent?.name}`);
        },
      }));
    }
    hooks.registerPipe(createCodeHook<{
      messages: HarnessMessage[];
      sourceMessages: HarnessMessage[];
    }>({
      id: 'add-llm-context',
      event: LLM_HOOK_EVENTS.input,
      run: ({ payload }) => ({
        payload: {
          ...payload,
          messages: [
            ...payload.messages,
            { role: 'system', content: 'hook context', timestamp: 3 },
          ],
        },
      }),
    }));
    hooks.registerPipe(createCodeHook<{ message: HarnessMessage }>({
      id: 'rewrite-llm-output',
      event: LLM_HOOK_EVENTS.output,
      run: ({ payload }) => ({
        payload: {
          message: {
            ...payload.message,
            content: `${payload.message.content}:hooked`,
          },
        },
      }),
    }));

    const signal = new AbortController().signal;
    const newMessages = await runHarnessLoop(
      [{ role: 'user', content: 'hello', timestamp: 2 }],
      context,
      {
        hooks,
        runTurn: async ({ messages }) => ({
          role: 'assistant',
          content: `saw ${messages.length}`,
          timestamp: 4,
        }),
      },
      async () => undefined,
      signal,
    );

    expect(newMessages.at(-1)?.content).toBe('saw 3:hooked');
    expect(context.messages.at(-1)?.content).toBe('saw 3:hooked');
    expect(calls).toEqual([
      'harness:loop.start',
      'agent:turn.start',
      'agent:message.start',
      'agent:message.end',
      'agent:message.start',
      'agent:message.end',
      'agent:turn.end',
      'harness:loop.end',
    ]);
  });

  it('passes undefined signals through agent loop hooks when no run signal is supplied', async () => {
    const hooks = new HookRegistry();
    const seenSignals: unknown[] = [];

    hooks.registerMiddleware(createCodeHook({
      id: 'observe-loop-signal',
      event: AGENT_LOOP_HOOK_EVENTS.loopStart,
      run: ({ signal }) => {
        seenSignals.push(signal);
      },
    }));

    await runHarnessLoop(
      [{ role: 'user', content: 'hello', timestamp: 1 }],
      { messages: [] },
      {
        hooks,
        runTurn: async () => ({ role: 'assistant', content: 'done', timestamp: 2 }),
      },
      async () => undefined,
    );

    expect(seenSignals).toEqual([undefined]);
  });

  it('fires actor workflow hooks around start, input, output, completion, and failure', async () => {
    const hooks = new HookRegistry();
    const calls: string[] = [];

    for (const event of [
      ACTOR_WORKFLOW_HOOK_EVENTS.started,
      ACTOR_WORKFLOW_HOOK_EVENTS.completed,
      ACTOR_WORKFLOW_HOOK_EVENTS.failed,
    ]) {
      hooks.registerMiddleware(createCodeHook({
        id: `observe-${event.name}`,
        event,
        run: ({ event: hookEvent }) => {
          calls.push(`${hookEvent?.type}:${hookEvent?.name}`);
        },
      }));
    }
    hooks.registerPipe(createCodeHook<{ input: string }>({
      id: 'rewrite-workflow-input',
      event: ACTOR_WORKFLOW_HOOK_EVENTS.input,
      run: ({ payload }) => ({ payload: { input: `${payload.input}:input-hook` } }),
    }));
    hooks.registerPipe(createCodeHook<{ output: string }>({
      id: 'rewrite-workflow-output',
      event: ACTOR_WORKFLOW_HOOK_EVENTS.output,
      run: ({ payload }) => ({ payload: { output: `${payload.output}:output-hook` } }),
    }));

    const signal = new AbortController().signal;

    await expect(runActorWorkflow({
      actorId: 'worker',
      input: 'task',
      hooks,
      signal,
      run: ({ input }) => `${input}:run`,
    })).resolves.toBe('task:input-hook:run:output-hook');
    await expect(runActorWorkflow({
      actorId: 'failing-worker',
      input: 'task',
      hooks,
      run: () => {
        throw new Error('boom');
      },
    })).rejects.toThrow('boom');
    expect(calls).toEqual([
      'agent:actor.workflow.started',
      'agent:actor.workflow.completed',
      'agent:actor.workflow.started',
      'agent:actor.workflow.failed',
    ]);
  });

  it('fires agent-bus hooks around append, read, tail, and poll operations', async () => {
    const hooks = new HookRegistry();
    const calls: string[] = [];

    for (const event of [
      AGENT_BUS_HOOK_EVENTS.append,
      AGENT_BUS_HOOK_EVENTS.appendResult,
      AGENT_BUS_HOOK_EVENTS.tail,
      AGENT_BUS_HOOK_EVENTS.tailResult,
      AGENT_BUS_HOOK_EVENTS.read,
      AGENT_BUS_HOOK_EVENTS.readResult,
      AGENT_BUS_HOOK_EVENTS.poll,
      AGENT_BUS_HOOK_EVENTS.pollResult,
    ]) {
      hooks.registerMiddleware(createCodeHook({
        id: `observe-${event.name}`,
        event,
        run: ({ event: hookEvent }) => {
          calls.push(`${hookEvent?.type}:${hookEvent?.name}`);
        },
      }));
    }
    hooks.registerPipe(createCodeHook<{ entryPayload: { type: PayloadType; content?: string; meta?: Record<string, unknown> } }>({
      id: 'tag-bus-append',
      event: AGENT_BUS_HOOK_EVENTS.append,
      run: ({ payload }) => ({
        payload: {
          entryPayload: {
            ...payload.entryPayload,
            meta: { ...payload.entryPayload.meta, hookTagged: true },
          },
        },
      }),
    }));

    const bus = createAgentBus({ hooks });
    await bus.append({ type: PayloadType.Mail, from: 'user', content: 'hello' });
    await bus.tail();
    await bus.read(0, 1);
    await bus.poll(0, [PayloadType.Mail]);

    expect((await readAgentBusEntries(bus))[0].payload).toMatchObject({
      meta: { hookTagged: true },
    });
    expect(calls).toEqual([
      'agent:bus.append',
      'agent:bus.append.result',
      'agent:bus.tail',
      'agent:bus.tail.result',
      'agent:bus.read',
      'agent:bus.read.result',
      'agent:bus.poll',
      'agent:bus.poll.result',
      'agent:bus.tail',
      'agent:bus.tail.result',
      'agent:bus.read',
      'agent:bus.read.result',
    ]);
  });

  it('applies hooks supplied directly to appendAgentEvent', async () => {
    const hooks = new HookRegistry();
    const signal = new AbortController().signal;
    const bus = createAgentBus();

    hooks.registerPipe(createCodeHook<{
      entryPayload: { meta?: Record<string, unknown> };
    }>({
      id: 'tag-append-event',
      event: AGENT_BUS_HOOK_EVENTS.append,
      run: ({ payload, signal: hookSignal }) => ({
        payload: {
          entryPayload: {
            ...payload.entryPayload,
            meta: { ...payload.entryPayload.meta, sawSignal: hookSignal === signal },
          },
        },
      }),
    }));

    await appendAgentEvent(bus, {
      eventType: 'custom.extension',
      actorId: 'agent',
      data: { ok: true },
    }, {
      hooks,
      hookOptions: { signal },
    });

    expect((await readAgentBusEntries(bus))[0].payload).toMatchObject({
      meta: { sawSignal: true },
    });
  });

});
