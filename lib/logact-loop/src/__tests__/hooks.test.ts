import { afterEach, describe, expect, it, vi } from 'vitest';
import { PayloadType } from 'logact';
import {
  trace,
  SpanKind,
  SpanStatusCode,
  type Attributes,
  type Span,
  type SpanOptions,
} from '@opentelemetry/api';
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

type RecordedSpan = {
  name: string;
  options: SpanOptions;
  attributes: Attributes;
  status?: { code: SpanStatusCode; message?: string };
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
        recordException: () => undefined,
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

  it('emits an OpenTelemetry span around LogAct driver inference', async () => {
    const spans = installRecordingTracer();

    await runLogActAgentLoop({
      inferenceClient: { infer: vi.fn().mockResolvedValue('draft') },
      messages: [{ content: 'task' }],
      bus: createAgentBus(),
      maxTurns: 1,
    }, {});

    expect(spans.find((span) => span.name === 'harness.llm.infer')).toMatchObject({
      options: { kind: SpanKind.CLIENT },
      attributes: {
        'gen_ai.operation.name': 'infer',
        'agent.actor.id': 'driver',
        'llm.input.messages.count': 1,
        'llm.input.characters': 4,
        'llm.output.characters': 5,
      },
      status: { code: SpanStatusCode.OK },
      ended: true,
    });
  });
});
