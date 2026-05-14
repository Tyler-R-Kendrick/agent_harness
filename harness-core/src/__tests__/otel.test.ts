import { afterEach, describe, expect, it } from 'vitest';
import {
  context,
  trace,
  SpanKind,
  SpanStatusCode,
  type Attributes,
  type Span,
  type SpanOptions,
} from '@opentelemetry/api';
import {
  AGENT_LOOP_HOOK_EVENTS,
  AgentLoopActorRegistry,
  HookRegistry,
  createCodeHook,
  runAgentEventLoop,
  runHarnessLoop,
  type HarnessMessage,
} from '../index.js';

type RecordedSpan = {
  name: string;
  options: SpanOptions;
  attributes: Attributes;
  status?: { code: SpanStatusCode; message?: string };
  exceptions: unknown[];
  ended: boolean;
};

function installRecordingTracer(): RecordedSpan[] {
  trace.disable();
  const spans: RecordedSpan[] = [];
  const tracer = {
    startSpan(name: string, options: SpanOptions = {}): Span {
      const record: RecordedSpan = {
        name,
        options,
        attributes: { ...(options.attributes ?? {}) },
        exceptions: [],
        ended: false,
      };
      spans.push(record);
      const span = {
        spanContext: () => ({
          traceId: '00000000000000000000000000000001',
          spanId: '0000000000000001',
          traceFlags: 1,
        }),
        setAttribute: (key: string, value: unknown) => {
          record.attributes[key] = value as never;
          return span;
        },
        setAttributes: (attributes: Attributes) => {
          Object.assign(record.attributes, attributes);
          return span;
        },
        addEvent: () => span,
        addLink: () => span,
        addLinks: () => span,
        setStatus: (status: { code: SpanStatusCode; message?: string }) => {
          record.status = status;
          return span;
        },
        updateName: (updatedName: string) => {
          record.name = updatedName;
          return span;
        },
        end: () => {
          record.ended = true;
        },
        isRecording: () => true,
        recordException: (exception: unknown) => {
          record.exceptions.push(exception);
        },
      } as Span;
      return span;
    },
  };
  trace.setGlobalTracerProvider({ getTracer: () => tracer } as never);
  return spans;
}

afterEach(() => {
  trace.disable();
});

describe('OpenTelemetry instrumentation', () => {
  it('emits spans for harness loops, LLM turns, and hook execution', async () => {
    const spans = installRecordingTracer();
    const hooks = new HookRegistry();

    hooks.registerMiddleware(createCodeHook({
      id: 'observe-loop-start',
      event: AGENT_LOOP_HOOK_EVENTS.loopStart,
      run: () => ({ output: 'observed' }),
    }));

    const result = await runHarnessLoop(
      [{ role: 'user', content: 'hello', timestamp: 1 } satisfies HarnessMessage],
      { messages: [] },
      {
        hooks,
        session: { id: 'session-otel', mode: 'local' },
        runTurn: async ({ messages }) => ({
          role: 'assistant',
          content: `saw ${messages.length}`,
          timestamp: 2,
        }),
      },
      async () => undefined,
    );

    expect(result.at(-1)?.content).toBe('saw 1');
    expect(spans.map((span) => span.name)).toEqual(expect.arrayContaining([
      'harness.agent.loop',
      'harness.llm.run_turn',
      'harness.hook.run',
    ]));
    expect(spans.find((span) => span.name === 'harness.agent.loop')).toMatchObject({
      attributes: {
        'agent.session.id': 'session-otel',
        'agent.session.mode': 'local',
        'agent.loop.prompt.count': 1,
      },
      ended: true,
      status: { code: SpanStatusCode.OK },
    });
    expect(spans.find((span) => span.name === 'harness.llm.run_turn')).toMatchObject({
      options: { kind: SpanKind.CLIENT },
      attributes: {
        'agent.session.id': 'session-otel',
        'llm.input.messages.count': 1,
        'llm.input.characters': 5,
        'llm.output.characters': 5,
      },
      status: { code: SpanStatusCode.OK },
    });
    expect(spans.find((span) => span.name === 'harness.hook.run')).toMatchObject({
      attributes: {
        'harness.hook.id': 'observe-loop-start',
        'harness.hook.point': 'harness:loop.start',
        'harness.hook.event.type': 'harness',
        'harness.hook.event.name': 'loop.start',
        'harness.hook.mode': 'middleware',
        'harness.hook.kind': 'deterministic',
        'harness.hook.format': 'code',
      },
      status: { code: SpanStatusCode.OK },
    });
  });

  it('records zero LLM characters for non-text harness messages', async () => {
    const spans = installRecordingTracer();

    await runHarnessLoop(
      [
        { role: 'user', timestamp: 1 },
        { role: 'user', content: 123, timestamp: 2 },
      ] as never,
      { messages: [] },
      {
        session: { id: 'session-non-text' },
        runTurn: async () => ({ role: 'assistant', content: 456, timestamp: 3 } as never),
      },
      async () => undefined,
    );

    expect(spans.find((span) => span.name === 'harness.llm.run_turn')).toMatchObject({
      attributes: {
        'agent.session.id': 'session-non-text',
        'llm.input.messages.count': 2,
        'llm.input.characters': 0,
        'llm.output.characters': 0,
      },
    });
  });

  it('emits workflow and actor spans for the serializable agent event loop', async () => {
    const spans = installRecordingTracer();
    const actors = new AgentLoopActorRegistry();

    actors.register({
      id: 'worker',
      event: 'start',
      run: async () => ({ event: { type: 'done' }, output: 'ok' }),
    });

    await runAgentEventLoop({
      id: 'workflow-otel',
      initial: 'running',
      states: {
        running: {
          events: [{ type: 'start', actorIds: ['worker'] }],
          on: { done: 'done' },
        },
        done: { type: 'final' },
      },
    }, {
      actors,
      runId: 'run-otel',
    });

    expect(spans.find((span) => span.name === 'harness.agent_event_loop.workflow')).toMatchObject({
      attributes: {
        'agent.workflow.id': 'workflow-otel',
        'agent.workflow.run_id': 'run-otel',
        'agent.workflow.final_state': 'done',
        'agent.workflow.transitions': 1,
      },
      status: { code: SpanStatusCode.OK },
    });
    expect(spans.find((span) => span.name === 'harness.agent_event_loop.actor')).toMatchObject({
      attributes: {
        'agent.workflow.id': 'workflow-otel',
        'agent.workflow.run_id': 'run-otel',
        'agent.workflow.state': 'running',
        'agent.actor.id': 'worker',
        'agent.event.type': 'start',
      },
      status: { code: SpanStatusCode.OK },
    });
  });

  it('marks failed hook spans with OTEL error status and recorded exceptions', async () => {
    const spans = installRecordingTracer();
    const hooks = new HookRegistry();

    hooks.registerMiddleware(createCodeHook({
      id: 'failing-hook',
      event: AGENT_LOOP_HOOK_EVENTS.loopStart,
      run: () => {
        throw new Error('hook exploded');
      },
    }));

    await expect(hooks.runEvent(AGENT_LOOP_HOOK_EVENTS.loopStart, {}))
      .rejects.toThrow('hook exploded');

    expect(spans.find((span) => span.name === 'harness.hook.run')).toMatchObject({
      attributes: { 'harness.hook.id': 'failing-hook' },
      status: { code: SpanStatusCode.ERROR, message: 'hook exploded' },
      exceptions: [expect.any(Error)],
      ended: true,
    });
  });

  it('records non-Error failures on telemetry spans', async () => {
    const spans = installRecordingTracer();
    const actors = new AgentLoopActorRegistry();

    actors.register({
      id: 'string-failure',
      event: 'start',
      run: async () => {
        throw 'offline';
      },
    });

    await expect(runAgentEventLoop({
      id: 'workflow-error',
      initial: 'running',
      states: {
        running: {
          events: [{ type: 'start', actorIds: ['string-failure'] }],
          on: { done: 'done' },
        },
        done: { type: 'final' },
      },
    }, {
      actors,
      runId: 'run-error',
    })).rejects.toThrow('offline');

    expect(spans.find((span) => span.name === 'harness.agent_event_loop.actor')).toMatchObject({
      status: { code: SpanStatusCode.ERROR, message: 'offline' },
      exceptions: [expect.any(Error)],
      ended: true,
    });
  });
});
