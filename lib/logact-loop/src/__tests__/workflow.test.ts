import { describe, expect, it, vi } from 'vitest';
import { InMemoryAgentBus, PayloadType, QuorumPolicy, type IntentPayload } from 'logact';
import { constrainToJsonSchema, type CoreInferenceOptions } from 'harness-core';
import {
  WorkflowAgentBus,
  createLogActWorkflowDefinition,
  runLogActAgentLoop,
  wrapCompletionCheckerWithCallbacks,
  wrapVoterWithCallbacks,
} from '../workflow.js';

describe('logact loop callback wrappers', () => {
  it('emits voter callbacks for approve, reject, thought, and error outcomes', async () => {
    const callbacks = {
      onVoterStep: vi.fn(),
      onVoterStepUpdate: vi.fn(),
      onVoterStepEnd: vi.fn(),
    };
    const fakeBus = {} as never;
    const approveIntent: IntentPayload = { type: PayloadType.Intent, intentId: 'i1', action: 'approve' };
    const rejectIntent: IntentPayload = { type: PayloadType.Intent, intentId: 'i2', action: 'reject' };
    const failIntent: IntentPayload = { type: PayloadType.Intent, intentId: 'i3', action: 'fail' };

    await wrapVoterWithCallbacks({
      id: 'approve',
      tier: 'classic',
      vote: vi.fn().mockResolvedValue({ type: PayloadType.Vote, intentId: 'i1', voterId: 'approve', approve: true }),
    }, callbacks).vote(approveIntent, fakeBus);
    await wrapVoterWithCallbacks({
      id: 'reject',
      tier: 'classic',
      vote: vi.fn().mockResolvedValue({
        type: PayloadType.Vote,
        intentId: 'i2',
        voterId: 'reject',
        approve: false,
        reason: 'blocked',
        thought: 'Unsafe command.',
      }),
    }, callbacks).vote(rejectIntent, fakeBus);
    await expect(wrapVoterWithCallbacks({
      id: 'fail',
      tier: 'classic',
      vote: vi.fn().mockRejectedValue(new Error('timeout')),
    }, callbacks).vote(failIntent, fakeBus)).rejects.toThrow('timeout');

    expect(callbacks.onVoterStep).toHaveBeenCalledTimes(3);
    expect(callbacks.onVoterStepUpdate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ approve: true, body: 'Approved' }));
    expect(callbacks.onVoterStepUpdate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      approve: false,
      body: 'Rejected: blocked',
      thought: 'Unsafe command.',
    }));
    expect(callbacks.onVoterStepUpdate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ approve: false, body: 'Error: timeout' }));
    expect(callbacks.onVoterStepEnd).toHaveBeenCalledTimes(3);
  });

  it('emits completion-checker callbacks for success and failure outcomes', async () => {
    const callbacks = {
      onIterationStep: vi.fn(),
      onIterationStepUpdate: vi.fn(),
      onIterationStepEnd: vi.fn(),
    };
    const successfulChecker = wrapCompletionCheckerWithCallbacks({
      check: vi.fn().mockResolvedValue({
        type: PayloadType.Completion,
        intentId: 'ignored',
        done: true,
        score: 'high',
        feedback: 'Complete.',
      }),
    }, callbacks);
    const failingChecker = wrapCompletionCheckerWithCallbacks({
      check: vi.fn().mockRejectedValue(new Error('judge failed')),
    }, callbacks);

    await expect(successfulChecker.check({ lastResult: {} as never, history: [] })).resolves.toEqual(expect.objectContaining({ done: true }));
    await expect(failingChecker.check({ lastResult: {} as never, history: [] })).rejects.toThrow('judge failed');

    expect(callbacks.onIterationStep).toHaveBeenCalledTimes(2);
    expect(callbacks.onIterationStepUpdate).toHaveBeenCalledWith(expect.stringContaining('iteration-1'), expect.objectContaining({
      score: 'high',
      done: true,
      body: 'Complete.',
    }));
    expect(callbacks.onIterationStepUpdate).toHaveBeenCalledWith(expect.stringContaining('iteration-1'), expect.objectContaining({
      done: false,
      body: 'Error: judge failed',
    }));
    expect(callbacks.onIterationStepEnd).toHaveBeenCalledTimes(2);
  });

  it('allows callback wrappers to run without subscribers and normalizes non-Error failures', async () => {
    const fakeBus = {} as never;
    const rejectIntent: IntentPayload = { type: PayloadType.Intent, intentId: 'i4', action: 'reject' };
    const failIntent: IntentPayload = { type: PayloadType.Intent, intentId: 'i5', action: 'fail' };

    await expect(wrapVoterWithCallbacks({
      id: 'reject-without-reason',
      tier: 'classic',
      vote: vi.fn().mockResolvedValue({
        type: PayloadType.Vote,
        intentId: 'i4',
        voterId: 'reject-without-reason',
        approve: false,
      }),
    }, {}).vote(rejectIntent, fakeBus)).resolves.toEqual(expect.objectContaining({ approve: false }));
    await expect(wrapVoterWithCallbacks({
      id: 'string-fail',
      tier: 'classic',
      vote: vi.fn().mockRejectedValue('offline'),
    }, {}).vote(failIntent, fakeBus)).rejects.toBe('offline');

    await expect(wrapCompletionCheckerWithCallbacks({
      check: vi.fn().mockResolvedValue({
        type: PayloadType.Completion,
        intentId: 'c3',
        done: false,
      }),
    }, {}).check({ lastResult: {} as never, history: [] })).resolves.toEqual(expect.objectContaining({ done: false }));
    await expect(wrapCompletionCheckerWithCallbacks({
      check: vi.fn().mockRejectedValue('judge offline'),
    }, {}).check({ lastResult: {} as never, history: [] })).rejects.toBe('judge offline');
  });

  it('reports no-reason rejections and string failures when subscribers are present', async () => {
    const callbacks = {
      onVoterStepUpdate: vi.fn(),
      onIterationStepUpdate: vi.fn(),
    };
    const fakeBus = {} as never;

    await wrapVoterWithCallbacks({
      id: 'reject-briefly',
      tier: 'classic',
      vote: vi.fn().mockResolvedValue({
        type: PayloadType.Vote,
        intentId: 'i6',
        voterId: 'reject-briefly',
        approve: false,
      }),
    }, callbacks).vote({ type: PayloadType.Intent, intentId: 'i6', action: 'reject' }, fakeBus);
    await expect(wrapVoterWithCallbacks({
      id: 'string-error',
      tier: 'classic',
      vote: vi.fn().mockRejectedValue('offline'),
    }, callbacks).vote({ type: PayloadType.Intent, intentId: 'i7', action: 'fail' }, fakeBus)).rejects.toBe('offline');

    await wrapCompletionCheckerWithCallbacks({
      check: vi.fn().mockResolvedValue({
        type: PayloadType.Completion,
        intentId: 'c4',
        done: false,
      }),
    }, callbacks).check({ lastResult: {} as never, history: [] });
    await expect(wrapCompletionCheckerWithCallbacks({
      check: vi.fn().mockRejectedValue('judge offline'),
    }, callbacks).check({ lastResult: {} as never, history: [] })).rejects.toBe('judge offline');

    expect(callbacks.onVoterStepUpdate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: 'Rejected' }));
    expect(callbacks.onVoterStepUpdate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: 'Error: offline' }));
    expect(callbacks.onIterationStepUpdate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ done: false }));
    expect(callbacks.onIterationStepUpdate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: 'Error: judge offline' }));
  });

  it('passes optional constrained decoding through to the inference client', async () => {
    const seenOptions: CoreInferenceOptions[] = [];
    const constrainedDecoding = constrainToJsonSchema({ type: 'object' });

    await runLogActAgentLoop({
      inferenceClient: {
        async infer(_messages, options) {
          seenOptions.push(options ?? {});
          return '';
        },
      },
      messages: [{ content: 'decide' }],
      constrainedDecoding,
    }, {});

    expect(seenOptions).toEqual([{ constrainedDecoding }]);
  });
});

describe('runLogActAgentLoop', () => {
  it('exposes a serializable XState workflow definition with agents for every LogAct role', () => {
    expect(createLogActWorkflowDefinition()).toMatchObject({
      id: 'local:logact-workflow',
      context: { session: { id: 'local', mode: 'local' }, voterIds: [], maxTurns: 1 },
    });

    const definition = createLogActWorkflowDefinition({
      id: 'workflow-session-1',
      session: { id: 'session-1', mode: 'local' },
      voterIds: ['allow', 'security'],
      maxTurns: 2,
    });

    expect(definition).toMatchObject({
      id: 'workflow-session-1',
      initial: 'awaitingTrigger',
      context: {
        session: { id: 'session-1', mode: 'local' },
        voterIds: ['allow', 'security'],
        maxTurns: 2,
      },
      states: {
        awaitingTrigger: { events: [{ type: 'logact.trigger', actorIds: ['waitForTriggerAgent'] }] },
        inferring: { events: [{ type: 'logact.driver', actorIds: ['driverAgent'] }] },
        voting: { events: [{ type: 'logact.voters', actorIds: ['voterAgents'], mode: 'parallel' }] },
        deciding: { events: [{ type: 'logact.decider', actorIds: ['deciderAgent'] }] },
        executing: { events: [{ type: 'logact.executor', actorIds: ['executorAgent'] }] },
        checkingCompletion: { events: [{ type: 'logact.completion', actorIds: ['completionCheckerAgent'] }] },
        done: { type: 'final' },
      },
    });
    expect(JSON.parse(JSON.stringify(definition))).toEqual(definition);
  });

  it('uses fallback actor metadata for bus messages without explicit actor meta', async () => {
    const bus = new WorkflowAgentBus({ session: { id: 'session-fallbacks' } });

    await bus.append({ type: PayloadType.Mail, from: 'browser-tab', content: 'hello' });
    await bus.append({ type: PayloadType.InfOut, text: 'assistant reply' });

    expect(bus.readActorMessageEvents()).toEqual([
      expect.objectContaining({
        actor: { id: 'browser-tab', role: 'user', sessionId: 'session-fallbacks' },
        message: expect.objectContaining({ role: 'user', content: 'hello' }),
      }),
      expect.objectContaining({
        actor: { id: 'driver', role: 'agent', sessionId: 'session-fallbacks' },
        message: expect.objectContaining({ role: 'assistant', content: 'assistant reply' }),
      }),
    ]);
  });

  it('runs the shared LogAct loop with default input, voters, and completion callbacks', async () => {
    const infer = vi.fn()
      .mockResolvedValueOnce('first draft')
      .mockResolvedValueOnce('final answer');
    const voter = {
      id: 'allow',
      tier: 'classic' as const,
      vote: vi.fn().mockResolvedValue({ type: PayloadType.Vote, intentId: 'ignored', voterId: 'allow', approve: true }),
    };
    const checker = {
      check: vi.fn()
        .mockResolvedValueOnce({ type: PayloadType.Completion, intentId: 'c1', done: false, score: 'med', feedback: 'Try again.' })
        .mockResolvedValueOnce({ type: PayloadType.Completion, intentId: 'c2', done: true, score: 'high', feedback: 'Done.' }),
    };
    const callbacks = {
      onVoterStep: vi.fn(),
      onIterationStep: vi.fn(),
    };
    const bus = new WorkflowAgentBus({ session: { id: 'session-run' } });

    await runLogActAgentLoop({
      inferenceClient: { infer },
      messages: [{ content: 'older' }, { content: 'latest' }],
      voters: [voter],
      bus,
      completionChecker: checker,
      maxIterations: 4,
    }, callbacks);

    const entries = await bus.read(0, await bus.tail());
    expect(infer).toHaveBeenCalledTimes(2);
    expect(voter.vote).toHaveBeenCalledTimes(2);
    expect(checker.check).toHaveBeenCalledTimes(2);
    expect(entries.map((entry) => entry.payload.type)).toEqual([
      PayloadType.Mail,
      PayloadType.InfIn,
      PayloadType.InfOut,
      PayloadType.Intent,
      PayloadType.Vote,
      PayloadType.Commit,
      PayloadType.Result,
      PayloadType.Completion,
      PayloadType.Mail,
      PayloadType.InfIn,
      PayloadType.InfOut,
      PayloadType.Intent,
      PayloadType.Vote,
      PayloadType.Commit,
      PayloadType.Result,
      PayloadType.Completion,
    ]);
    expect(bus.readActorMessageEvents()).toEqual([
      expect.objectContaining({
        type: 'actor.message',
        sessionId: 'session-run',
        actor: { id: 'user', role: 'user', sessionId: 'session-run' },
        message: expect.objectContaining({ role: 'user', content: 'latest' }),
      }),
      expect.objectContaining({
        type: 'actor.message',
        sessionId: 'session-run',
        actor: { id: 'driver', role: 'agent', sessionId: 'session-run' },
        message: expect.objectContaining({ role: 'assistant', content: 'first draft' }),
      }),
      expect.objectContaining({
        type: 'actor.message',
        sessionId: 'session-run',
        actor: { id: 'completion-checker', role: 'agent', sessionId: 'session-run' },
        message: expect.objectContaining({ role: 'user', content: 'Try again.' }),
      }),
      expect.objectContaining({
        type: 'actor.message',
        sessionId: 'session-run',
        actor: { id: 'driver', role: 'agent', sessionId: 'session-run' },
        message: expect.objectContaining({ role: 'assistant', content: 'final answer' }),
      }),
    ]);
    expect(bus.readWorkflowEvents()).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'xstate.snapshot', value: 'inferring' }),
      expect.objectContaining({ type: 'xstate.snapshot', value: 'voting' }),
      expect.objectContaining({ type: 'xstate.snapshot', value: 'deciding' }),
      expect.objectContaining({ type: 'xstate.snapshot', value: 'executing' }),
    ]));
    expect(callbacks.onVoterStep).toHaveBeenCalled();
    expect(callbacks.onIterationStep).toHaveBeenCalled();
  });

  it('accepts explicit input, custom quorum policy, executor, and swallowed provider failures', async () => {
    const infer = vi.fn()
      .mockResolvedValueOnce('custom action')
      .mockRejectedValueOnce(new Error('provider down'));
    const execute = vi.fn().mockResolvedValue('executed');

    await runLogActAgentLoop({
      inferenceClient: { infer },
      messages: [{ content: 'ignored' }],
      input: 'explicit',
      quorumPolicy: QuorumPolicy.OnByDefault,
      executor: { tier: 'llm-active', execute },
    }, {});
    await expect(runLogActAgentLoop({
      inferenceClient: { infer },
      messages: [],
      maxTurns: 1,
    }, {})).resolves.toBeUndefined();

    expect(execute).toHaveBeenCalledWith('custom action');
  });

  it('stops when the driver agent receives a terminal blank inference', async () => {
    const bus = new WorkflowAgentBus({ session: { id: 'session-terminal' } });

    await runLogActAgentLoop({
      inferenceClient: { infer: vi.fn().mockResolvedValue('   ') },
      messages: [{ content: 'stop after prompt' }],
      bus,
      maxTurns: 3,
    }, {});

    const entries = await bus.read(0, await bus.tail());
    expect(entries.map((entry) => entry.payload.type)).toEqual([
      PayloadType.Mail,
      PayloadType.InfIn,
    ]);
  });

  it('records executor agent errors as result payloads', async () => {
    const bus = new WorkflowAgentBus({ session: { id: 'session-executor-error' } });

    await runLogActAgentLoop({
      inferenceClient: { infer: vi.fn().mockResolvedValue('run fragile action') },
      messages: [{ content: 'do it' }],
      bus,
      executor: {
        tier: 'llm-active',
        execute: vi.fn().mockRejectedValue(new Error('tool failed')),
      },
      maxTurns: 1,
    }, {});

    const entries = await bus.read(0, await bus.tail());
    expect(entries.find((entry) => entry.payload.type === PayloadType.Result)?.payload)
      .toEqual(expect.objectContaining({ output: '', error: 'tool failed' }));
  });

  it('normalizes non-Error executor failures and completion passes without feedback', async () => {
    const bus = new WorkflowAgentBus({ session: { id: 'session-string-error' } });
    const checker = {
      check: vi.fn().mockResolvedValue({
        type: PayloadType.Completion,
        intentId: 'ignored',
        done: false,
      }),
    };

    await runLogActAgentLoop({
      inferenceClient: { infer: vi.fn().mockResolvedValue('run brittle action') },
      messages: [{ content: 'do it anyway' }],
      bus,
      executor: {
        tier: 'llm-active',
        execute: vi.fn().mockRejectedValue('offline'),
      },
      completionChecker: checker,
      maxTurns: 1,
    }, {});

    const entries = await bus.read(0, await bus.tail());
    expect(entries.find((entry) => entry.payload.type === PayloadType.Result)?.payload)
      .toEqual(expect.objectContaining({ output: '', error: 'offline' }));
    expect(entries.filter((entry) => entry.payload.type === PayloadType.Mail)).toHaveLength(1);
  });

  it('runs against a generic AgentBus without workflow event capture', async () => {
    const bus = new InMemoryAgentBus();

    await runLogActAgentLoop({
      inferenceClient: { infer: vi.fn().mockResolvedValue('plain bus action') },
      messages: [{ content: 'use generic bus' }],
      bus,
      maxTurns: 1,
    }, {});

    expect((await bus.read(0, await bus.tail())).map((entry) => entry.payload.type)).toContain(PayloadType.Result);
  });

  it('feeds executor error results into the next driver turn when more turns remain', async () => {
    const bus = new WorkflowAgentBus({ session: { id: 'session-error-recovery' } });
    const infer = vi.fn()
      .mockResolvedValueOnce('fragile action')
      .mockResolvedValueOnce('');

    await runLogActAgentLoop({
      inferenceClient: { infer },
      messages: [{ content: 'try fragile tool' }],
      bus,
      executor: {
        tier: 'llm-active',
        execute: vi.fn().mockRejectedValue(new Error('tool failed')),
      },
      maxTurns: 2,
    }, {});

    expect(infer).toHaveBeenCalledTimes(2);
    expect(infer.mock.calls[1][0].at(-1)).toEqual({
      role: 'user',
      content: 'Error: tool failed',
    });
  });

  it('routes rejected votes through the decider agent without executing', async () => {
    const bus = new WorkflowAgentBus({ session: { id: 'session-reject' } });
    const execute = vi.fn().mockResolvedValue('should not run');

    await runLogActAgentLoop({
      inferenceClient: { infer: vi.fn().mockResolvedValue('delete everything') },
      messages: [{ content: 'danger' }],
      bus,
      voters: [{
        id: 'deny',
        tier: 'classic',
        vote: vi.fn().mockResolvedValue({
          type: PayloadType.Vote,
          intentId: 'ignored',
          voterId: 'deny',
          approve: false,
          reason: 'unsafe',
        }),
      }],
      quorumPolicy: QuorumPolicy.BooleanAnd,
      executor: { tier: 'llm-active', execute },
      maxTurns: 1,
    }, {});

    const entries = await bus.read(0, await bus.tail());
    expect(execute).not.toHaveBeenCalled();
    expect(entries.map((entry) => entry.payload.type)).toContain(PayloadType.Abort);
    expect(entries.find((entry) => entry.payload.type === PayloadType.Abort)?.payload)
      .toEqual(expect.objectContaining({ reason: 'unsafe' }));
  });

  it('feeds abort messages back through the driver agent when more turns remain', async () => {
    const bus = new WorkflowAgentBus({ session: { id: 'session-abort-recover' } });
    const infer = vi.fn()
      .mockResolvedValueOnce('dangerous action')
      .mockResolvedValueOnce('');

    await runLogActAgentLoop({
      inferenceClient: { infer },
      messages: [{ content: 'try something risky' }],
      bus,
      voters: [{
        id: 'deny',
        tier: 'classic',
        vote: vi.fn().mockResolvedValue({
          type: PayloadType.Vote,
          intentId: 'ignored',
          voterId: 'deny',
          approve: false,
        }),
      }],
      quorumPolicy: QuorumPolicy.BooleanAnd,
      maxTurns: 2,
    }, {});

    expect(infer).toHaveBeenCalledTimes(2);
    expect(infer.mock.calls[1][0].at(-1)).toEqual({
      role: 'user',
      content: 'Action was aborted: no reason given',
    });
  });
});
