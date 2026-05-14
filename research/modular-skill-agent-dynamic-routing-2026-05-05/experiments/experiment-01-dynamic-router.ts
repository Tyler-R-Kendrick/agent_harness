export type SkillCategory = 'reasoning' | 'language' | 'analysis' | 'composite';

export interface TaskEnvelope {
  readonly id: string;
  readonly prompt: string;
  readonly expectedSkill: string;
}

export interface SkillDefinition {
  readonly id: string;
  readonly category: SkillCategory;
  readonly keywords: readonly string[];
  run(task: TaskEnvelope, runtime: SkillRuntime): string;
}

export interface RoutingDecision {
  readonly selectedSkillId: string;
  readonly score: number;
  readonly reason: string;
}

export interface StepTelemetry {
  readonly taskId: string;
  readonly selectedSkillId: string;
  readonly score: number;
  readonly success: boolean;
}

export class SkillRegistry {
  private readonly skills = new Map<string, SkillDefinition>();

  register(skill: SkillDefinition): void {
    this.skills.set(skill.id, skill);
  }

  all(): readonly SkillDefinition[] {
    return [...this.skills.values()];
  }

  resolve(skillId: string): SkillDefinition {
    const skill = this.skills.get(skillId);
    if (!skill) throw new Error(`Unknown skill: ${skillId}`);
    return skill;
  }
}

export class SkillRuntime {
  readonly telemetry: StepTelemetry[] = [];

  constructor(private readonly registry: SkillRegistry, private readonly fallbackSkillId: string) {}

  route(task: TaskEnvelope): RoutingDecision {
    const lowerPrompt = task.prompt.toLowerCase();
    const ranked = this.registry
      .all()
      .map((skill) => {
        const hits = skill.keywords.filter((keyword) => lowerPrompt.includes(keyword)).length;
        const score = hits / Math.max(skill.keywords.length, 1);
        return { skill, score };
      })
      .sort((a, b) => b.score - a.score);

    const top = ranked[0];
    if (!top || top.score < 0.2) {
      return { selectedSkillId: this.fallbackSkillId, score: 0, reason: 'low-confidence-fallback' };
    }

    return {
      selectedSkillId: top.skill.id,
      score: top.score,
      reason: `keyword-match:${top.score.toFixed(2)}`,
    };
  }

  execute(task: TaskEnvelope): string {
    const decision = this.route(task);
    return this.executeWithDecision(task, decision);
  }

  executeBySkillId(task: TaskEnvelope, skillId: string, reason = 'forced-skill'): string {
    const decision: RoutingDecision = { selectedSkillId: skillId, score: 1, reason };
    return this.executeWithDecision(task, decision);
  }

  private executeWithDecision(task: TaskEnvelope, decision: RoutingDecision): string {
    const selected = this.registry.resolve(decision.selectedSkillId);
    const output = selected.run(task, this);
    this.telemetry.push({
      taskId: task.id,
      selectedSkillId: decision.selectedSkillId,
      score: decision.score,
      success: decision.selectedSkillId === task.expectedSkill,
    });
    return output;
  }
}

export function buildDefaultRuntime(): SkillRuntime {
  const registry = new SkillRegistry();

    registry.register({
    id: 'calculator',
    category: 'analysis',
    keywords: ['calculate', 'sum', 'multiply', 'divide', 'math'],
    run: (task) => `calculated:${task.prompt}`,
  });

  registry.register({
    id: 'summarizer',
    category: 'language',
    keywords: ['summarize', 'summary', 'condense', 'tl;dr'],
    run: (task) => `summary:${task.prompt}`,
  });

  registry.register({
    id: 'translator',
    category: 'language',
    keywords: ['translate', 'spanish', 'french', 'german'],
    run: (task) => `translation:${task.prompt}`,
  });

  registry.register({
    id: 'research-report',
    category: 'composite',
    keywords: ['research', 'report', 'investigate'],
    run: (task, runtime) => {
      const summary = runtime.executeBySkillId(
        { ...task, id: `${task.id}:summary`, expectedSkill: 'summarizer', prompt: `summarize ${task.prompt}` },
        'summarizer',
        'composite-child',
      );
      const translation = runtime.executeBySkillId(
        { ...task, id: `${task.id}:translation`, expectedSkill: 'translator', prompt: `translate to spanish ${task.prompt}` },
        'translator',
        'composite-child',
      );
      return `report:${summary}|${translation}`;
    },
  });

  return new SkillRuntime(registry, 'summarizer');
}

export interface ExperimentResult {
  readonly routeAccuracy: number;
  readonly fallbackRate: number;
  readonly totalSteps: number;
}

export function runExperiment(tasks: readonly TaskEnvelope[]): ExperimentResult {
  const runtime = buildDefaultRuntime();
  for (const task of tasks) runtime.execute(task);

  const total = runtime.telemetry.length;
  const hits = runtime.telemetry.filter((row) => row.success).length;
  const fallbacks = runtime.telemetry.filter((row) => row.score === 0).length;

  return {
    routeAccuracy: total === 0 ? 0 : hits / total,
    fallbackRate: total === 0 ? 0 : fallbacks / total,
    totalSteps: total,
  };
}
