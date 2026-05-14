export type SkillId = string;

export interface SkillDoc {
  readonly id: SkillId;
  readonly title: string;
  readonly markdown: string;
  readonly protected?: boolean;
}

export interface Task {
  readonly id: string;
  readonly groupId: string;
  readonly order: number;
  readonly difficulty: number;
  readonly topic: string;
}

export interface TaskOutcome {
  readonly taskId: string;
  readonly quality: number;
  readonly cost: number;
}

export interface RewardWeights {
  readonly quality: number;
  readonly efficiency: number;
  readonly transfer: number;
  readonly regressions: number;
}

export type SkillOp =
  | { readonly kind: 'create'; readonly skill: SkillDoc }
  | { readonly kind: 'update'; readonly id: SkillId; readonly markdown: string }
  | { readonly kind: 'prune'; readonly id: SkillId };

export interface RepoVersion {
  readonly version: number;
  readonly skills: readonly SkillDoc[];
}

export const DEFAULT_WEIGHTS: RewardWeights = {
  quality: 1,
  efficiency: 0.2,
  transfer: 1.2,
  regressions: 1.5,
};

export function executeTask(task: Task, repo: RepoVersion): TaskOutcome {
  const related = repo.skills.filter((skill) => skill.title.includes(task.topic)).length;
  const quality = Math.max(0, 100 - task.difficulty * 10 + related * 5);
  const cost = Math.max(1, 20 + task.difficulty * 2 - related);

  return { taskId: task.id, quality, cost };
}

export function computeCompositeReward(
  outcomes: readonly TaskOutcome[],
  transferGain: number,
  regressions: number,
  weights: RewardWeights,
): number {
  if (outcomes.length === 0) {
    return 0;
  }

  const avgQuality = outcomes.reduce((sum, outcome) => sum + outcome.quality, 0) / outcomes.length;
  const avgCost = outcomes.reduce((sum, outcome) => sum + outcome.cost, 0) / outcomes.length;
  const efficiency = 1 / avgCost;

  return (
    weights.quality * avgQuality +
    weights.efficiency * efficiency +
    weights.transfer * transferGain -
    weights.regressions * regressions
  );
}

export function proposeOps(task: Task, reward: number, repo: RepoVersion): readonly SkillOp[] {
  if (reward < 45) {
    return [
      {
        kind: 'create',
        skill: {
          id: `skill-${repo.version}-${task.id}`,
          title: `${task.topic} pattern`,
          markdown: `# ${task.topic}\n- distilled pattern for difficulty ${task.difficulty}`,
        },
      },
    ];
  }

  if (repo.skills.length > 6) {
    const prunable = repo.skills.find((skill) => !skill.protected);
    if (prunable) {
      return [{ kind: 'prune', id: prunable.id }];
    }
  }

  const firstRelated = repo.skills.find((skill) => skill.title.includes(task.topic));
  if (firstRelated) {
    return [{ kind: 'update', id: firstRelated.id, markdown: `${firstRelated.markdown}\n- refined` }];
  }

  return [];
}

export function validateOps(ops: readonly SkillOp[], repo: RepoVersion, maxSkills = 20): readonly string[] {
  const reasons: string[] = [];
  const ids = new Set(repo.skills.map((skill) => skill.id));

  for (const op of ops) {
    if (op.kind === 'create') {
      if (ids.has(op.skill.id)) {
        reasons.push(`duplicate id ${op.skill.id}`);
      }
      if (op.skill.markdown.length < 10) {
        reasons.push(`skill too short ${op.skill.id}`);
      }
    }

    if (op.kind === 'update') {
      if (!ids.has(op.id)) {
        reasons.push(`missing skill ${op.id}`);
      }
    }

    if (op.kind === 'prune') {
      const target = repo.skills.find((skill) => skill.id === op.id);
      if (!target) {
        reasons.push(`missing skill ${op.id}`);
      } else if (target.protected) {
        reasons.push(`protected skill ${op.id}`);
      }
    }
  }

  const creates = ops.filter((op) => op.kind === 'create').length;
  const prunes = ops.filter((op) => op.kind === 'prune').length;
  const projectedSize = repo.skills.length + creates - prunes;
  if (projectedSize > maxSkills) {
    reasons.push(`repo limit exceeded ${projectedSize}/${maxSkills}`);
  }

  return reasons;
}

export function applyOps(ops: readonly SkillOp[], repo: RepoVersion): RepoVersion {
  let skills = [...repo.skills];

  for (const op of ops) {
    if (op.kind === 'create') {
      skills.push(op.skill);
    } else if (op.kind === 'update') {
      skills = skills.map((skill) => (skill.id === op.id ? { ...skill, markdown: op.markdown } : skill));
    } else {
      skills = skills.filter((skill) => skill.id !== op.id);
    }
  }

  return {
    version: repo.version + 1,
    skills,
  };
}

export function runGroupedCuration(tasks: readonly Task[], seedRepo: RepoVersion): RepoVersion {
  let repo = seedRepo;
  const grouped = new Map<string, Task[]>();

  for (const task of tasks) {
    const prior = grouped.get(task.groupId) ?? [];
    grouped.set(task.groupId, [...prior, task]);
  }

  for (const [, groupTasks] of grouped) {
    const ordered = [...groupTasks].sort((a, b) => a.order - b.order);
    const outcomes: TaskOutcome[] = ordered.map((task) => executeTask(task, repo));

    const early = outcomes.slice(0, Math.floor(outcomes.length / 2));
    const late = outcomes.slice(Math.floor(outcomes.length / 2));
    const earlyQuality = early.length === 0 ? 0 : early.reduce((s, o) => s + o.quality, 0) / early.length;
    const lateQuality = late.length === 0 ? 0 : late.reduce((s, o) => s + o.quality, 0) / late.length;
    const transferGain = lateQuality - earlyQuality;
    const regressions = transferGain < 0 ? 1 : 0;

    const reward = computeCompositeReward(outcomes, transferGain, regressions, DEFAULT_WEIGHTS);
    const ops = proposeOps(ordered[ordered.length - 1], reward, repo);
    const violations = validateOps(ops, repo);

    if (violations.length === 0) {
      repo = applyOps(ops, repo);
    }
  }

  return repo;
}
