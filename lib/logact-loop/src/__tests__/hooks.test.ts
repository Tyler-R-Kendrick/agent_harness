import { describe, expect, it, vi } from 'vitest';
import { PayloadType } from 'logact';
import {
  AGENT_BUS_HOOK_EVENTS,
  HookRegistry,
  LLM_HOOK_EVENTS,
  createAgentBus,
  createCodeHook,
} from 'harness-core';
import {
  LOGACT_AGENT_LOOP_HOOK_EVENTS,
  WorkflowAgentBus,
  runLogActAgentLoop,
} from '../index.js';

describe('logact loop hooks', () => {
  it('wraps WorkflowAgentBus operations when constructed with hooks', async () => {
    const hooks = new HookRegistry();
    const calls: string[] = [];

    hooks.registerMiddleware(createCodeHook({
      id: 'observe-workflow-bus-append',
      event: AGENT_BUS_HOOK_EVENTS.append,
      run: ({ event }) => {
        calls.push(`${event?.type}:${event?.name}`);
      },
    }));

    const bus = new WorkflowAgentBus({ hooks });
    await bus.append({ type: PayloadType.Mail, from: 'user', content: 'hello' });

    expect(calls).toEqual(['agent:bus.append']);
  });

  it('fires LogAct loop hooks around LLM driver input and output', async () => {
    const hooks = new HookRegistry();
    const calls: string[] = [];
    const infer = vi.fn(async (messages: Array<{ content: string }>) => {
      expect(messages.map((message) => message.content)).toContain('hook context');
      return 'draft';
    });

    hooks.registerMiddleware(createCodeHook({
      id: 'observe-logact-start',
      event: LOGACT_AGENT_LOOP_HOOK_EVENTS.loopStart,
      run: ({ event }) => {
        calls.push(`${event?.type}:${event?.name}`);
      },
    }));
    hooks.registerPipe(createCodeHook<{
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    }>({
      id: 'add-logact-context',
      event: LLM_HOOK_EVENTS.input,
      run: ({ payload }) => ({
        payload: {
          messages: [
            ...payload.messages,
            { role: 'system', content: 'hook context' },
          ],
        },
      }),
    }));
    hooks.registerPipe(createCodeHook<{ text: string; actorId: string }>({
      id: 'rewrite-logact-output',
      event: LLM_HOOK_EVENTS.output,
      run: ({ payload }) => ({
        payload: { ...payload, text: `${payload.text}:hooked` },
      }),
    }));

    await runLogActAgentLoop({
      inferenceClient: { infer },
      messages: [{ content: 'task' }],
      bus: createAgentBus(),
      maxTurns: 1,
      hooks,
    }, {});

    expect(infer).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['agent:logact.loop.start']);
  });
});
