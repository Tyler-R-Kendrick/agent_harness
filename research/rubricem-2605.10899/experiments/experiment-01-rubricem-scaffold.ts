export type StageName = 'plan' | 'evidence' | 'review' | 'synthesis';

export interface RubricDimension {
  readonly name: string;
  readonly weight: number;
}

export interface RubricStage {
  readonly stage: StageName;
  readonly weight: number;
  readonly dimensions: readonly RubricDimension[];
}

export interface TaskRubric {
  readonly taskId: string;
  readonly stages: readonly RubricStage[];
}

export interface StageOutput {
  readonly stage: StageName;
  readonly content: string;
  readonly tokensUsed: number;
}

export interface StageScore {
  readonly stage: StageName;
  readonly dimensionScores: Readonly<Record<string, number>>;
  readonly weightedStageScore: number;
}

export interface TrajectoryResult {
  readonly outputs: readonly StageOutput[];
  readonly scores: readonly StageScore[];
  readonly totalCredit: number;
}

export interface MetaPolicyMemory {
  readonly stageGuidance: Readonly<Record<StageName, string>>;
  readonly revision: number;
}

export const DEFAULT_MEMORY: MetaPolicyMemory = {
  revision: 1,
  stageGuidance: {
    plan: 'Decompose into checkpoints before any tool call.',
    evidence: 'Collect at least two independent sources.',
    review: 'Check claim-source alignment and contradictions.',
    synthesis: 'Summarize claims with confidence qualifiers.',
  },
};

export function buildDefaultRubric(taskId: string): TaskRubric {
  return {
    taskId,
    stages: [
      { stage: 'plan', weight: 0.2, dimensions: [{ name: 'coverage', weight: 1 }] },
      { stage: 'evidence', weight: 0.35, dimensions: [{ name: 'relevance', weight: 0.5 }, { name: 'support', weight: 0.5 }] },
      { stage: 'review', weight: 0.25, dimensions: [{ name: 'consistency', weight: 1 }] },
      { stage: 'synthesis', weight: 0.2, dimensions: [{ name: 'clarity', weight: 1 }] },
    ],
  };
}

export function runStagePolicies(rubric: TaskRubric, memory: MetaPolicyMemory): StageOutput[] {
  return rubric.stages.map((rubricStage) => {
    const guidance = memory.stageGuidance[rubricStage.stage];
    return {
      stage: rubricStage.stage,
      content: `[${rubricStage.stage}] ${guidance}`,
      tokensUsed: guidance.length,
    };
  });
}

export function judgeStages(rubric: TaskRubric, outputs: readonly StageOutput[]): StageScore[] {
  return rubric.stages.map((rubricStage) => {
    const output = outputs.find((candidate) => candidate.stage === rubricStage.stage);
    const quality = output ? Math.min(1, output.content.length / 120) : 0;

    const dimensionScores = rubricStage.dimensions.reduce<Record<string, number>>((acc, dimension) => {
      acc[dimension.name] = quality * dimension.weight;
      return acc;
    }, {});

    const dimensionTotal = Object.values(dimensionScores).reduce((sum, value) => sum + value, 0);
    return {
      stage: rubricStage.stage,
      dimensionScores,
      weightedStageScore: dimensionTotal * rubricStage.weight,
    };
  });
}

export function aggregateCredit(scores: readonly StageScore[]): number {
  return scores.reduce((sum, score) => sum + score.weightedStageScore, 0);
}

export function reflectAndUpdate(memory: MetaPolicyMemory, result: TrajectoryResult): MetaPolicyMemory {
  const evidenceScore = result.scores.find((score) => score.stage === 'evidence')?.weightedStageScore ?? 0;

  if (evidenceScore < 0.2) {
    return {
      revision: memory.revision + 1,
      stageGuidance: {
        ...memory.stageGuidance,
        evidence: 'Collect three sources with explicit cross-check notes.',
      },
    };
  }

  return {
    revision: memory.revision + 1,
    stageGuidance: {
      ...memory.stageGuidance,
      review: 'Run contradiction scan before final synthesis.',
    },
  };
}

export function runRubricAttempt(taskId: string, memory: MetaPolicyMemory): {
  readonly result: TrajectoryResult;
  readonly updatedMemory: MetaPolicyMemory;
} {
  const rubric = buildDefaultRubric(taskId);
  const outputs = runStagePolicies(rubric, memory);
  const scores = judgeStages(rubric, outputs);
  const totalCredit = aggregateCredit(scores);

  const result: TrajectoryResult = {
    outputs,
    scores,
    totalCredit,
  };

  return {
    result,
    updatedMemory: reflectAndUpdate(memory, result),
  };
}
