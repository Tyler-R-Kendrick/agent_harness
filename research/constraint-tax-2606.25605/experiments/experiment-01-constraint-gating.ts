export type DecodingMode = 'free' | 'constrained';

export type TaskKind = 'planning' | 'tool-selection' | 'dsl-emission';

export type OutputKind = 'reasoning-text' | 'tool-call' | 'dsl-block';

export interface GenerationEvent {
  readonly step: number;
  readonly task: TaskKind;
  readonly output: OutputKind;
  readonly label: string;
}

export interface PolicyRule {
  readonly task: TaskKind;
  readonly output: OutputKind;
  readonly mode: DecodingMode;
}

export interface TraceEntry {
  readonly step: number;
  readonly label: string;
  readonly mode: DecodingMode;
}

export interface ConstrainedSpan {
  readonly startStep: number;
  readonly endStep: number;
}

export interface GatingState {
  readonly mode: DecodingMode;
  readonly trace: readonly TraceEntry[];
  readonly openSpanStart: number | null;
  readonly spans: readonly ConstrainedSpan[];
}

export const DEFAULT_POLICY: readonly PolicyRule[] = [
  { task: 'planning', output: 'reasoning-text', mode: 'free' },
  { task: 'tool-selection', output: 'tool-call', mode: 'free' },
  { task: 'dsl-emission', output: 'dsl-block', mode: 'constrained' },
];

export function decideMode(
  policy: readonly PolicyRule[],
  task: TaskKind,
  output: OutputKind,
): DecodingMode {
  for (const rule of policy) {
    if (rule.task === task && rule.output === output) {
      return rule.mode;
    }
  }
  return 'free';
}

export function initialState(): GatingState {
  return { mode: 'free', trace: [], openSpanStart: null, spans: [] };
}

export function transition(
  state: GatingState,
  event: GenerationEvent,
  policy: readonly PolicyRule[],
): GatingState {
  const required = decideMode(policy, event.task, event.output);
  const trace: TraceEntry[] = [
    ...state.trace,
    { step: event.step, label: event.label, mode: required },
  ];

  let openSpanStart = state.openSpanStart;
  let spans = state.spans;

  if (state.mode === 'free' && required === 'constrained') {
    openSpanStart = event.step;
  } else if (state.mode === 'constrained' && required === 'free' && state.openSpanStart !== null) {
    spans = [...state.spans, { startStep: state.openSpanStart, endStep: event.step - 1 }];
    openSpanStart = null;
  }

  return { mode: required, trace, openSpanStart, spans };
}

export function finalize(state: GatingState, lastStep: number): GatingState {
  if (state.openSpanStart === null) {
    return state;
  }
  return {
    ...state,
    openSpanStart: null,
    spans: [...state.spans, { startStep: state.openSpanStart, endStep: lastStep }],
  };
}

export function checkInvariant(
  trace: readonly TraceEntry[],
  events: readonly GenerationEvent[],
): boolean {
  if (trace.length !== events.length) {
    return false;
  }
  for (let index = 0; index < trace.length; index += 1) {
    const constrained = trace[index].mode === 'constrained';
    const isEmission = events[index].output === 'dsl-block';
    if (constrained !== isEmission) {
      return false;
    }
  }
  return true;
}

export const SCRIPTED_SEQUENCE: readonly GenerationEvent[] = [
  { step: 1, task: 'planning', output: 'reasoning-text', label: 'reason-about-goal' },
  { step: 2, task: 'tool-selection', output: 'tool-call', label: 'select-browser-tool' },
  { step: 3, task: 'dsl-emission', output: 'dsl-block', label: 'emit-intent-program' },
  { step: 4, task: 'planning', output: 'reasoning-text', label: 'reason-about-result' },
  { step: 5, task: 'dsl-emission', output: 'dsl-block', label: 'emit-verification-block' },
];

export function runDemo(): string[] {
  let state = initialState();
  for (const event of SCRIPTED_SEQUENCE) {
    state = transition(state, event, DEFAULT_POLICY);
  }
  state = finalize(state, SCRIPTED_SEQUENCE[SCRIPTED_SEQUENCE.length - 1].step);

  const lines: string[] = [];
  for (const entry of state.trace) {
    lines.push(`step ${entry.step} [${entry.mode}] ${entry.label}`);
  }
  for (const span of state.spans) {
    lines.push(`constrained-span: steps ${span.startStep}-${span.endStep}`);
  }
  const ok = checkInvariant(state.trace, SCRIPTED_SEQUENCE);
  lines.push(`invariant(constrained-only-inside-emission): ${ok ? 'ok' : 'VIOLATED'}`);
  return lines;
}

for (const line of runDemo()) {
  console.log(line);
}
