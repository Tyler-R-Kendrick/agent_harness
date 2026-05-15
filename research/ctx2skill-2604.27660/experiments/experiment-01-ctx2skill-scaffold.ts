export interface Task {
  readonly id: string;
  readonly rubricCount: number;
  readonly rubricPassCount: number;
}

export interface IterationOutcome {
  readonly solved: readonly Task[];
  readonly failed: readonly Task[];
}

export interface ReplayScore {
  readonly index: number;
  readonly rhoHard: number;
  readonly rhoEasy: number;
  readonly product: number;
}

export interface ProbeBank {
  readonly hard: readonly Task[];
  readonly easy: readonly Task[];
}

export function partitionTasks(tasks: readonly Task[]): IterationOutcome {
  const solved: Task[] = [];
  const failed: Task[] = [];

  for (const task of tasks) {
    if (task.rubricPassCount >= task.rubricCount) {
      solved.push(task);
      continue;
    }
    failed.push(task);
  }

  return { solved, failed };
}

export function selectHardProbe(failed: readonly Task[]): Task | undefined {
  if (failed.length === 0) {
    return undefined;
  }

  return [...failed].sort((a, b) => (a.rubricPassCount / a.rubricCount) - (b.rubricPassCount / b.rubricCount))[0];
}

export function selectEasyProbe(solved: readonly Task[]): Task | undefined {
  if (solved.length === 0) {
    return undefined;
  }

  return [...solved].sort((a, b) => a.rubricCount - b.rubricCount)[0];
}

export function laplaceRate(solved: number, total: number): number {
  return (solved + 1) / (total + 1);
}

export function computeReplayScores(
  hardSolvedBySnapshot: readonly number[],
  easySolvedBySnapshot: readonly number[],
  hardTotal: number,
  easyTotal: number,
): ReplayScore[] {
  const length = Math.min(hardSolvedBySnapshot.length, easySolvedBySnapshot.length);
  const table: ReplayScore[] = [];

  for (let index = 0; index < length; index += 1) {
    const rhoHard = laplaceRate(hardSolvedBySnapshot[index], hardTotal);
    const rhoEasy = laplaceRate(easySolvedBySnapshot[index], easyTotal);

    table.push({
      index,
      rhoHard,
      rhoEasy,
      product: rhoHard * rhoEasy,
    });
  }

  return table;
}

export function selectBestSnapshot(scores: readonly ReplayScore[]): ReplayScore | undefined {
  if (scores.length === 0) {
    return undefined;
  }

  return [...scores].sort((a, b) => b.product - a.product)[0];
}
