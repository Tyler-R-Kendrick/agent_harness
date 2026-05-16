import { PayloadType, type IAgentBus, type IntentPayload } from 'logact';
import { describe, expect, it, vi } from 'vitest';

import {
  HookRegistry,
  LLM_HOOK_EVENTS,
  LOGACT_AGENT_LOOP_HOOK_EVENTS,
  WorkflowAgentBus,
  constrainToJsonSchema,
  createCodeHook,
  createLogActWorkflowDefinition,
  hookPointForEvent,
  runLogActAgentLoop,
  wrapCompletionCheckerWithCallbacks,
  wrapVoterWithCallbacks,
  type CoreInferenceOptions,
} from '../index.js';

function createSequenceInference(outputs: string[]) {
  const calls: Array<{
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    options?: CoreInferenceOptions;
  }> = [];

  return {
    calls,
    client: {
      infer: async (
        messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
        options?: CoreInferenceOptions,
      ) => {
        calls.push({ messages, options });
        return outputs.shift() ?? '';
      },
    },
  };
}

async function payloads(bus: IAgentBus) {
  return (await bus.read(0, await bus.tail())).map((entry) => entry.payload);
}

describe('workflow agent bus and LogAct workflow loop', () => {
  it('records workflow events and actor messages from bus payloads', async () => {
    const bus = new WorkflowAgentBus({ session: { id: 'workflow-session' } });
    const hookedBus = new WorkflowAgentBus({ hooks: new HookRegistry() });

    await bus.append({ type: PayloadType.Mail, from: 'operator', content: 'hello' });
    await bus.append({ type: PayloadType.InfOut, text: 'assistant reply' });
    await bus.append({ type: PayloadType.Intent, intentId: 'intent-1', action: 'ignored for messages' });
    bus.sendWorkflowEvent({ type: 'START' });
    bus.recordWorkflowSnapshot('done', 'done');

    expect(bus.session).toEqual({ id: 'workflow-session', mode: 'local' });
    expect(hookedBus.session).toEqual({ id: 'local', mode: 'local' });
    expect(await bus.tail()).toBe(3);
    expect((await bus.read(0, 1))[0]?.payload).toEqual(expect.objectContaining({ type: PayloadType.Mail }));
    expect((await bus.poll(1, [PayloadType.InfOut]))[0]?.payload).toEqual(
      expect.objectContaining({ type: PayloadType.InfOut }),
    );
    expect(bus.readActorMessageEvents().map((event) => ({
      role: event.message.role,
      content: event.message.content,
      actorId: event.actor.id,
    }))).toEqual([
      { role: 'user', content: 'hello', actorId: 'operator' },
      { role: 'assistant', content: 'assistant reply', actorId: 'driver' },
    ]);
    expect(bus.readWorkflowEvents()).toEqual([
      expect.objectContaining({ type: 'xstate.event', sessionId: 'workflow-session' }),
      expect.objectContaining({ type: 'xstate.snapshot', sessionId: 'workflow-session', value: 'done' }),
    ]);
  });

  it('builds default and customized LogAct workflow definitions', () => {
    expect(createLogActWorkflowDefinition()).toEqual(expect.objectContaining({
      id: 'local:logact-workflow',
      initial: 'awaitingTrigger',
      context: {
        session: { id: 'local', mode: 'local' },
        voterIds: [],
        maxTurns: 1,
      },
    }));

    const definition = createLogActWorkflowDefinition({
      id: 'custom-workflow',
      session: { id: 'session-1' },
      voterIds: ['safety', 'quality'],
      maxTurns: 3,
    });

    expect(definition.context.voterIds).toEqual(['safety', 'quality']);
    expect(Object.keys(definition.states)).toEqual([
      'awaitingTrigger',
      'inferring',
      'voting',
      'deciding',
      'executing',
      'checkingCompletion',
      'done',
    ]);
  });

  it('runs a default commit workflow with the built-in executor', async () => {
    const bus = new WorkflowAgentBus({ session: { id: 'commit-session' } });
    const inference = createSequenceInference(['ship package']);

    await runLogActAgentLoop({
      inferenceClient: inference.client,
      messages: [{ content: 'fallback input' }],
      input: 'publish the diff',
      bus,
      maxTurns: 1,
    }, {});

    expect((await payloads(bus)).map((payload) => payload.type)).toEqual([
      PayloadType.Mail,
      PayloadType.InfIn,
      PayloadType.InfOut,
      PayloadType.Intent,
      PayloadType.Commit,
      PayloadType.Result,
    ]);
    expect(await payloads(bus)).toContainEqual(expect.objectContaining({
      type: PayloadType.Result,
      output: 'ship package',
    }));
    expect(bus.readWorkflowEvents().some((event) => event.type === 'xstate.event')).toBe(true);
  });

  it('passes constrained decoding through hooks and records executor errors', async () => {
    const bus = new WorkflowAgentBus({ session: { id: 'error-session' } });
    const hooks = new HookRegistry();
    const hookEvents: string[] = [];
    hooks.register(createCodeHook({
      id: 'record-loop-start',
      event: LOGACT_AGENT_LOOP_HOOK_EVENTS.loopStart,
      run: (event) => {
        hookEvents.push(event.event?.name ?? '');
      },
    }));
    hooks.register(createCodeHook<{ action: string }>({
      id: 'rewrite-executor-action',
      event: LOGACT_AGENT_LOOP_HOOK_EVENTS.executorInput,
      run: (event) => ({ payload: { ...event.payload, action: `${event.payload.action}!` } }),
    }));

    const constrainedDecoding = constrainToJsonSchema({ type: 'object' });
    const inference = createSequenceInference(['explode']);

    await runLogActAgentLoop({
      inferenceClient: inference.client,
      messages: [{ content: 'run task' }],
      bus,
      maxTurns: 1,
      hooks,
      constrainedDecoding,
      executor: {
        tier: 'classic',
        execute: async (action) => {
          throw new Error(`cannot execute ${action}`);
        },
      },
    }, {});

    expect(hookEvents).toEqual(['logact.loop.start']);
    expect(inference.calls[0]?.options?.constrainedDecoding).toBe(constrainedDecoding);
    expect(await payloads(bus)).toContainEqual(expect.objectContaining({
      type: PayloadType.Result,
      output: '',
      error: 'cannot execute explode!',
    }));
  });

  it('runs without a supplied bus and falls back to the last message as input', async () => {
    const inference = createSequenceInference(['']);

    await runLogActAgentLoop({
      inferenceClient: inference.client,
      messages: [{ content: 'first' }, { content: 'last message input' }],
    }, {});

    expect(inference.calls[0]?.messages).toContainEqual({
      role: 'user',
      content: 'last message input',
    });
  });

  it('uses an empty string when no input or messages are available', async () => {
    const inference = createSequenceInference(['']);

    await runLogActAgentLoop({
      inferenceClient: inference.client,
      messages: [],
    }, {});

    expect(inference.calls[0]?.messages).toContainEqual({
      role: 'user',
      content: '',
    });
  });

  it('routes rejection votes into an abort turn and feeds abort context back to inference', async () => {
    const bus = new WorkflowAgentBus({ session: { id: 'abort-session' } });
    const inference = createSequenceInference(['delete production', '']);

    await runLogActAgentLoop({
      inferenceClient: inference.client,
      messages: [{ content: 'dangerous task' }],
      bus,
      maxTurns: 2,
      voters: [{
        id: 'safety',
        tier: 'classic',
        vote: async (intent) => ({
          type: PayloadType.Vote,
          intentId: intent.intentId,
          voterId: 'safety',
          approve: false,
        }),
      }],
    }, {});

    expect(await payloads(bus)).toContainEqual(expect.objectContaining({
      type: PayloadType.Abort,
      reason: undefined,
    }));
    expect(inference.calls.at(-1)?.messages).toContainEqual({
      role: 'user',
      content: 'Action was aborted: no reason given',
    });
  });

  it('feeds executor string errors back into the next inference turn', async () => {
    const bus = new WorkflowAgentBus({ session: { id: 'string-error-session' } });
    const inference = createSequenceInference(['explode', '']);

    await runLogActAgentLoop({
      inferenceClient: inference.client,
      messages: [{ content: 'run string failure' }],
      bus,
      maxTurns: 2,
      executor: {
        tier: 'classic',
        execute: async () => {
          throw 'string boom';
        },
      },
    }, {});

    expect(await payloads(bus)).toContainEqual(expect.objectContaining({
      type: PayloadType.Result,
      error: 'string boom',
    }));
    expect(inference.calls.at(-1)?.messages).toContainEqual({
      role: 'user',
      content: 'Error: string boom',
    });
  });

  it('uses completion feedback as the next workflow turn', async () => {
    const bus = new WorkflowAgentBus({ session: { id: 'completion-session' } });
    const inference = createSequenceInference(['first draft', '']);

    await runLogActAgentLoop({
      inferenceClient: inference.client,
      messages: [{ content: 'write summary' }],
      bus,
      maxTurns: 2,
      completionChecker: {
        check: async ({ task, lastResult, history }) => ({
          type: PayloadType.Completion,
          intentId: lastResult.intentId,
          done: false,
          score: 'low',
          feedback: `${task}:${history.length}:revise`,
        }),
      },
    }, {});

    expect(await payloads(bus)).toContainEqual(expect.objectContaining({
      type: PayloadType.Completion,
      done: false,
      feedback: 'write summary:6:revise',
    }));
    expect(await payloads(bus)).toContainEqual(expect.objectContaining({
      type: PayloadType.Mail,
      from: 'completion-checker',
      content: 'write summary:6:revise',
    }));
  });

  it('does not append completion feedback when the checker is already done', async () => {
    const bus = new WorkflowAgentBus({ session: { id: 'completion-done-session' } });
    const inference = createSequenceInference(['final draft']);

    await runLogActAgentLoop({
      inferenceClient: inference.client,
      messages: [{ content: 'write final' }],
      bus,
      maxTurns: 2,
      completionChecker: {
        check: async ({ lastResult }) => ({
          type: PayloadType.Completion,
          intentId: lastResult.intentId,
          done: true,
          feedback: '   ',
        }),
      },
    }, {});

    expect((await payloads(bus)).filter((payload) =>
      payload.type === PayloadType.Mail && payload.from === 'completion-checker')).toEqual([]);
  });

  it('adds sketch-of-thought prompts and grammar constraints to driver inference', async () => {
    const bus = new WorkflowAgentBus({ session: { id: 'sketch-session' } });
    const inference = createSequenceInference(['summarize API']);

    await runLogActAgentLoop({
      inferenceClient: inference.client,
      messages: [{ content: 'summarize the API' }],
      bus,
      maxTurns: 1,
      sketchOfThought: {
        topic: 'API',
        expertLexiconSummary: 'API SDK JSON',
        maxTokens: 32,
      },
    }, {});

    expect(inference.calls[0]?.messages[0]).toEqual(expect.objectContaining({
      role: 'system',
      content: expect.stringContaining('Sketch-of-Thought Expert Agent'),
    }));
    expect(inference.calls[0]?.options?.constrainedDecoding).toEqual(expect.objectContaining({
      kind: 'toon',
      maxTokens: 32,
    }));
  });
});

describe('workflow callback adapters', () => {
  it('reports completion checker success and failures', async () => {
    const callbacks = {
      onIterationStep: vi.fn(),
      onIterationStepUpdate: vi.fn(),
      onIterationStepEnd: vi.fn(),
    };
    const wrapped = wrapCompletionCheckerWithCallbacks({
      check: async () => ({
        type: PayloadType.Completion,
        intentId: 'intent-1',
        done: true,
        score: 'high',
        feedback: 'complete',
      }),
    }, callbacks);

    await expect(wrapped.check({
      task: 'task',
      history: [],
      lastResult: { type: PayloadType.Result, intentId: 'intent-1', output: 'ok' },
    })).resolves.toEqual(expect.objectContaining({ done: true }));
    expect(callbacks.onIterationStep).toHaveBeenCalledWith(expect.objectContaining({
      id: 'iteration-1',
      status: 'active',
    }));
    expect(callbacks.onIterationStepUpdate).toHaveBeenCalledWith('iteration-1', expect.objectContaining({
      status: 'done',
      body: 'complete',
      score: 'high',
      done: true,
    }));
    expect(callbacks.onIterationStepEnd).toHaveBeenCalledWith('iteration-1');

    const failing = wrapCompletionCheckerWithCallbacks({
      check: async () => {
        throw 'checker failed';
      },
    }, callbacks);

    await expect(failing.check({
      task: 'task',
      history: [],
      lastResult: { type: PayloadType.Result, intentId: 'intent-2', output: 'bad' },
    })).rejects.toBe('checker failed');
    expect(callbacks.onIterationStepUpdate).toHaveBeenCalledWith('iteration-1', expect.objectContaining({
      body: 'Error: checker failed',
      done: false,
    }));

    const errorFailing = wrapCompletionCheckerWithCallbacks({
      check: async () => {
        throw new Error('checker exploded');
      },
    }, callbacks);

    await expect(errorFailing.check({
      task: 'task',
      history: [],
      lastResult: { type: PayloadType.Result, intentId: 'intent-3', output: 'bad' },
    })).rejects.toThrow('checker exploded');
    expect(callbacks.onIterationStepUpdate).toHaveBeenCalledWith('iteration-1', expect.objectContaining({
      body: 'Error: checker exploded',
      done: false,
    }));
  });

  it('reports voter approvals, rejections, thoughts, and failures', async () => {
    const callbacks = {
      onVoterStep: vi.fn(),
      onVoterStepUpdate: vi.fn(),
      onVoterStepEnd: vi.fn(),
    };
    const intent: IntentPayload = {
      type: PayloadType.Intent,
      intentId: 'intent-1',
      action: 'ship',
    };
    const bus = new WorkflowAgentBus();
    const approving = wrapVoterWithCallbacks({
      id: 'quality',
      tier: 'classic',
      vote: async () => ({
        type: PayloadType.Vote,
        intentId: intent.intentId,
        voterId: 'quality',
        approve: true,
        thought: 'looks good',
      }),
    }, callbacks);

    await expect(approving.vote(intent, bus)).resolves.toEqual(expect.objectContaining({ approve: true }));
    expect(callbacks.onVoterStepUpdate).toHaveBeenCalledWith('voter-quality-intent-1', expect.objectContaining({
      approve: true,
      body: 'Approved',
      thought: 'looks good',
    }));

    const rejecting = wrapVoterWithCallbacks({
      id: 'security',
      tier: 'classic',
      vote: async () => ({
        type: PayloadType.Vote,
        intentId: intent.intentId,
        voterId: 'security',
        approve: false,
        reason: 'unsafe',
      }),
    }, callbacks);
    await expect(rejecting.vote(intent, bus)).resolves.toEqual(expect.objectContaining({ approve: false }));
    expect(callbacks.onVoterStepUpdate).toHaveBeenCalledWith('voter-security-intent-1', expect.objectContaining({
      approve: false,
      body: 'Rejected: unsafe',
    }));

    const rejectingWithoutReason = wrapVoterWithCallbacks({
      id: 'style',
      tier: 'classic',
      vote: async () => ({
        type: PayloadType.Vote,
        intentId: intent.intentId,
        voterId: 'style',
        approve: false,
      }),
    }, callbacks);
    await expect(rejectingWithoutReason.vote(intent, bus)).resolves.toEqual(expect.objectContaining({ approve: false }));
    expect(callbacks.onVoterStepUpdate).toHaveBeenCalledWith('voter-style-intent-1', expect.objectContaining({
      approve: false,
      body: 'Rejected',
    }));

    const failing = wrapVoterWithCallbacks({
      id: 'broken',
      tier: 'classic',
      vote: async () => {
        throw new Error('voter exploded');
      },
    }, callbacks);
    await expect(failing.vote(intent, bus)).rejects.toThrow('voter exploded');
    expect(callbacks.onVoterStepUpdate).toHaveBeenCalledWith('voter-broken-intent-1', expect.objectContaining({
      approve: false,
      body: 'Error: voter exploded',
    }));

    const stringFailing = wrapVoterWithCallbacks({
      id: 'string-broken',
      tier: 'classic',
      vote: async () => {
        throw 'voter string failure';
      },
    }, callbacks);
    await expect(stringFailing.vote(intent, bus)).rejects.toBe('voter string failure');
    expect(callbacks.onVoterStepUpdate).toHaveBeenCalledWith('voter-string-broken-intent-1', expect.objectContaining({
      approve: false,
      body: 'Error: voter string failure',
    }));
  });

  it('exposes callback wrappers through the root workflow entry point', () => {
    expect(hookPointForEvent(LLM_HOOK_EVENTS.output)).toBe('llm:output');
    expect(typeof wrapCompletionCheckerWithCallbacks).toBe('function');
    expect(typeof wrapVoterWithCallbacks).toBe('function');
  });
});
