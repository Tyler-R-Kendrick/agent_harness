export interface Observation {
  readonly state: string;
}

export interface Transition {
  readonly success: boolean;
  readonly cost: number;
}

export interface EnvironmentAdapter {
  observe(): Observation;
  planAndAct(observation: Observation, config: HarnessConfig): string;
  step(action: string): Transition;
}

export interface HarnessConfig {
  readonly plannerDepth: number;
  readonly memoryWindow: number;
  readonly reflectionSuffix: string;
}

export interface TrajectoryEvent {
  readonly t: number;
  readonly obs: Observation;
  readonly action: string;
  readonly success: boolean;
  readonly actionCost: number;
}

export class TrajectoryStore {
  private readonly rows: TrajectoryEvent[] = [];

  append(event: TrajectoryEvent): void {
    this.rows.push(event);
  }

  recent(n: number): TrajectoryEvent[] {
    return this.rows.slice(-n);
  }
}

export const DEFAULT_HARNESS: HarnessConfig = {
  plannerDepth: 2,
  memoryWindow: 20,
  reflectionSuffix: 'Focus on recent failure modes.',
};

export function evaluateWindow(window: readonly TrajectoryEvent[]): number {
  if (window.length === 0) {
    return 0;
  }

  const successes = window.filter((event) => event.success).length;
  const cost = window.reduce((total, event) => total + event.actionCost, 0);

  return successes - cost * 0.01;
}

export function proposeEdit(config: HarnessConfig, score: number): HarnessConfig {
  if (score < 0) {
    return {
      ...config,
      plannerDepth: Math.min(config.plannerDepth + 1, 6),
    };
  }

  return {
    ...config,
    memoryWindow: Math.min(config.memoryWindow + 5, 100),
  };
}

export function validateEdit(config: HarnessConfig): boolean {
  return config.plannerDepth >= 1 && config.plannerDepth <= 6 && config.memoryWindow >= 5 && config.memoryWindow <= 100;
}

export function runLoop(env: EnvironmentAdapter, steps = 500, adaptEvery = 50): HarnessConfig {
  let config = DEFAULT_HARNESS;
  const store = new TrajectoryStore();

  for (let t = 1; t <= steps; t += 1) {
    const observation = env.observe();
    const action = env.planAndAct(observation, config);
    const transition = env.step(action);

    store.append({
      t,
      obs: observation,
      action,
      success: transition.success,
      actionCost: transition.cost,
    });

    if (t % adaptEvery === 0) {
      const window = store.recent(adaptEvery);
      const score = evaluateWindow(window);
      const candidate = proposeEdit(config, score);
      if (validateEdit(candidate)) {
        config = candidate;
      }
    }
  }

  return config;
}
