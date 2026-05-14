export interface TaskContext {
  readonly goal: string;
  readonly constraints: readonly string[];
}

export interface StrategyCandidate {
  readonly id: string;
  readonly text: string;
}

export interface StepOutcome {
  readonly success: boolean;
  readonly cost: number;
}

export interface EnvironmentAdapter {
  observe(): TaskContext;
  act(action: string): StepOutcome;
}

export interface ActionPolicy {
  nextAction(context: TaskContext, strategy: StrategyCandidate): string;
}

export type StrategyDecision =
  | { readonly type: 'keep' }
  | { readonly type: 'refine'; readonly candidate: StrategyCandidate }
  | { readonly type: 'resample'; readonly candidate: StrategyCandidate };

export interface StrategyEvent {
  readonly step: number;
  readonly strategyId: string;
  readonly action: string;
  readonly success: boolean;
  readonly cost: number;
}

export class TrajectoryLedger {
  private readonly rows: StrategyEvent[] = [];

  append(event: StrategyEvent): void {
    this.rows.push(event);
  }

  recent(windowSize: number): StrategyEvent[] {
    return this.rows.slice(-windowSize);
  }

  all(): StrategyEvent[] {
    return [...this.rows];
  }
}

export function generateCandidates(context: TaskContext): StrategyCandidate[] {
  return [
    { id: 'S1', text: `Prioritize fast progress toward ${context.goal}` },
    { id: 'S2', text: `Minimize costly steps while advancing ${context.goal}` },
    { id: 'S3', text: `Use conservative actions under constraints` },
  ];
}

export function evaluateWindow(events: readonly StrategyEvent[]): number {
  if (events.length === 0) {
    return 0;
  }

  const successScore = events.filter((event) => event.success).length;
  const costPenalty = events.reduce((sum, event) => sum + event.cost, 0) * 0.02;
  return successScore - costPenalty;
}

export function validateStrategy(candidate: StrategyCandidate): boolean {
  return candidate.text.length > 10 && candidate.text.length <= 160;
}

export function criticalJudge(
  active: StrategyCandidate,
  recent: readonly StrategyEvent[],
  fallback: readonly StrategyCandidate[],
): StrategyDecision {
  const score = evaluateWindow(recent);
  if (score >= 0) {
    return { type: 'keep' };
  }

  if (active.text.length < 120) {
    return {
      type: 'refine',
      candidate: { ...active, text: `${active.text}. Add explicit verification before costly actions.` },
    };
  }

  return { type: 'resample', candidate: fallback[0] ?? active };
}

export function runStrategicLoop(
  env: EnvironmentAdapter,
  policy: ActionPolicy,
  steps = 300,
  adaptEvery = 30,
): { readonly finalStrategy: StrategyCandidate; readonly events: StrategyEvent[] } {
  const context = env.observe();
  const candidates = generateCandidates(context);
  let active = candidates[0];
  const ledger = new TrajectoryLedger();

  for (let step = 1; step <= steps; step += 1) {
    const action = policy.nextAction(context, active);
    const outcome = env.act(action);

    ledger.append({
      step,
      strategyId: active.id,
      action,
      success: outcome.success,
      cost: outcome.cost,
    });

    if (step % adaptEvery === 0) {
      const recent = ledger.recent(adaptEvery);
      const decision = criticalJudge(active, recent, candidates);

      if (decision.type !== 'keep' && validateStrategy(decision.candidate)) {
        active = decision.candidate;
      }
    }
  }

  return { finalStrategy: active, events: ledger.all() };
}
