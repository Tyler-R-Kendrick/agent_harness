export type SpanKind = 'episode' | 'model_call' | 'tool_call';

export interface SpanAttributes {
  readonly kind: SpanKind;
  readonly agentId: string;
  readonly input: string;
  readonly output: string;
  readonly toolName?: string;
}

export interface TraceSpan {
  readonly name: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly startUnixMs: number;
  readonly endUnixMs: number;
  readonly attributes: SpanAttributes;
  readonly reward?: number;
}

export interface RLTransition {
  readonly index: number;
  readonly sourceSpanId: string;
  readonly state: string;
  readonly action: string;
  readonly reward: number;
  readonly nextState: string;
  readonly done: boolean;
}

const EPISODE_START_MS = 1755000000000;

export const FIXTURE_SPANS: readonly TraceSpan[] = [
  {
    name: 'episode:answer-question',
    spanId: 'E1',
    startUnixMs: EPISODE_START_MS,
    endUnixMs: EPISODE_START_MS + 5000,
    attributes: { kind: 'episode', agentId: 'agent-a', input: 'user: capital of France?', output: 'Paris' },
    reward: 1,
  },
  {
    name: 'gen_ai.chat model-call-1',
    spanId: 'M1',
    parentSpanId: 'E1',
    startUnixMs: EPISODE_START_MS + 100,
    endUnixMs: EPISODE_START_MS + 900,
    attributes: { kind: 'model_call', agentId: 'agent-a', input: 'user: capital of France?', output: 'call lookup(France)' },
  },
  {
    name: 'gen_ai.tool lookup',
    spanId: 'T1',
    parentSpanId: 'M1',
    startUnixMs: EPISODE_START_MS + 1000,
    endUnixMs: EPISODE_START_MS + 1400,
    attributes: { kind: 'tool_call', agentId: 'agent-a', input: 'France', output: 'capital=Paris', toolName: 'lookup' },
  },
  {
    name: 'gen_ai.chat model-call-2',
    spanId: 'M2',
    parentSpanId: 'E1',
    startUnixMs: EPISODE_START_MS + 1500,
    endUnixMs: EPISODE_START_MS + 2300,
    attributes: { kind: 'model_call', agentId: 'agent-a', input: 'tool result received', output: 'draft: Paris' },
    reward: 0.2,
  },
  {
    name: 'gen_ai.chat model-call-3',
    spanId: 'M3',
    parentSpanId: 'E1',
    startUnixMs: EPISODE_START_MS + 2400,
    endUnixMs: EPISODE_START_MS + 3200,
    attributes: { kind: 'model_call', agentId: 'agent-a', input: 'finalize answer', output: 'final: Paris' },
  },
];

function byStartTime(a: TraceSpan, b: TraceSpan): number {
  return a.startUnixMs - b.startUnixMs;
}

export function toTransitions(spans: readonly TraceSpan[]): RLTransition[] {
  const episode = spans.filter((span) => span.attributes.kind === 'episode')[0];
  const episodeReward = episode !== undefined && episode.reward !== undefined ? episode.reward : 0;
  const modelCalls = spans.filter((span) => span.attributes.kind === 'model_call').sort(byStartTime);
  const toolCalls = spans.filter((span) => span.attributes.kind === 'tool_call').sort(byStartTime);

  const transitions: RLTransition[] = [];
  let state = episode !== undefined ? episode.attributes.input : '';

  for (let index = 0; index < modelCalls.length; index += 1) {
    const call = modelCalls[index];
    const isLast = index === modelCalls.length - 1;
    const foldedTools = toolCalls
      .filter((tool) => tool.startUnixMs >= call.endUnixMs && (isLast || tool.endUnixMs <= modelCalls[index + 1].startUnixMs))
      .map((tool) => `[tool ${tool.attributes.toolName}: ${tool.attributes.output}]`)
      .join(' ');

    const nextState = isLast
      ? 'terminal'
      : `${modelCalls[index + 1].attributes.input}${foldedTools === '' ? '' : ` ${foldedTools}`}`;

    transitions.push({
      index,
      sourceSpanId: call.spanId,
      state,
      action: call.attributes.output,
      reward: (call.reward !== undefined ? call.reward : 0) + (isLast ? episodeReward : 0),
      nextState,
      done: isLast,
    });
    state = nextState;
  }

  return transitions;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function pad(value: string, width: number): string {
  let out = value;
  while (out.length < width) {
    out += ' ';
  }
  return out;
}

export function runDemo(): RLTransition[] {
  const transitions = toTransitions(FIXTURE_SPANS);

  assert(transitions.length === 3, 'one transition per model-call span');
  assert(transitions.every((t, i) => t.index === i), 'transitions ordered by span start time');
  assert(transitions[0].nextState.indexOf('capital=Paris') >= 0, 'tool span folded into next observation');
  assert(transitions[1].reward === 0.2, 'per-span reward slot preserved');
  assert(transitions[2].reward === 1 && transitions[2].done, 'episode reward on terminal transition');

  console.log('idx | source | reward | done  | state -> action');
  for (const t of transitions) {
    console.log(
      `${pad(String(t.index), 3)} | ${pad(t.sourceSpanId, 6)} | ${pad(t.reward.toFixed(2), 6)} | ` +
        `${pad(String(t.done), 5)} | ${t.state} -> ${t.action}`,
    );
  }
  console.log('all assertions passed');
  return transitions;
}

runDemo();
