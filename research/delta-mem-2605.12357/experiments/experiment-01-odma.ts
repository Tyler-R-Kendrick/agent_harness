/*
 * Experiment 01: Online Delta Memory Adapter scaffold
 * Deterministic, dependency-free reference implementation.
 */

type Vector = number[];
type Matrix = number[][];

interface EncodedEvent {
  key: Vector;
  value: Vector;
  label: string;
}

interface RecallResult {
  query: string;
  expectedIndex: number;
  predictedIndex: number;
  score: number;
  hit: boolean;
}

interface ExperimentSummary {
  withMemoryAvgScore: number;
  noMemoryAvgScore: number;
  improvement: number;
  hits: number;
  total: number;
}

class DeltaMemory {
  private readonly eta: number;
  private readonly state: Matrix;

  public constructor(dValue: number, dKey: number, eta: number) {
    this.eta = eta;
    this.state = Array.from({ length: dValue }, () => Array(dKey).fill(0));
  }

  public update(key: Vector, value: Vector): void {
    const prediction = this.read(key);
    for (let i = 0; i < this.state.length; i += 1) {
      const error = value[i] - prediction[i];
      for (let j = 0; j < this.state[i].length; j += 1) {
        this.state[i][j] += this.eta * error * key[j];
      }
    }
  }

  public read(query: Vector): Vector {
    return this.state.map((row) => dot(row, query));
  }
}

const dot = (a: Vector, b: Vector): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
};

const cosine = (a: Vector, b: Vector): number => {
  const numerator = dot(a, b);
  const denom = Math.sqrt(dot(a, a)) * Math.sqrt(dot(b, b));
  if (denom === 0) {
    return 0;
  }
  return numerator / denom;
};

const facts: EncodedEvent[] = [
  { label: 'api key in vault', key: [1, 0, 0, 0, 1, 0, 0, 0], value: [1, 0, 0, 0, 0, 0, 0, 0] },
  { label: 'billing uses project-zeta', key: [0, 1, 0, 0, 0, 1, 0, 0], value: [0, 1, 0, 0, 0, 0, 0, 0] },
  { label: 'deploy region us-east', key: [0, 0, 1, 0, 0, 0, 1, 0], value: [0, 0, 1, 0, 0, 0, 0, 0] },
  { label: 'pager duty oncall is nova', key: [0, 0, 0, 1, 0, 0, 0, 1], value: [0, 0, 0, 1, 0, 0, 0, 0] },
];

const runRecall = (memoryEnabled: boolean): RecallResult[] => {
  const memory = new DeltaMemory(8, 8, 0.2);

  for (const fact of facts) {
    if (memoryEnabled) {
      memory.update(fact.key, fact.value);
    }
    // Distractor: query-like event without meaningful value update.
    if (memoryEnabled) {
      memory.update([0, 0, 0, 0, 1, 1, 1, 1], [0, 0, 0, 0, 0, 0, 0, 0]);
    }
  }

  return facts.map((fact, expectedIndex) => {
    const readout = memory.read(fact.key);
    let bestScore = -Infinity;
    let bestIndex = -1;

    for (let i = 0; i < facts.length; i += 1) {
      const candidate = facts[i].value;
      const score = cosine(readout, candidate);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    return {
      query: fact.label,
      expectedIndex,
      predictedIndex: bestIndex,
      score: Number(bestScore.toFixed(4)),
      hit: bestIndex === expectedIndex,
    };
  });
};

const summarize = (results: RecallResult[]): { avgScore: number; hits: number } => {
  const totalScore = results.reduce((acc, cur) => acc + cur.score, 0);
  const hits = results.filter((r) => r.hit).length;
  return { avgScore: Number((totalScore / results.length).toFixed(4)), hits };
};

export const runExperiment = (): ExperimentSummary => {
  const withMemory = runRecall(true);
  const noMemory = runRecall(false);

  const withMemoryStats = summarize(withMemory);
  const noMemoryStats = summarize(noMemory);

  return {
    withMemoryAvgScore: withMemoryStats.avgScore,
    noMemoryAvgScore: noMemoryStats.avgScore,
    improvement: Number((withMemoryStats.avgScore - noMemoryStats.avgScore).toFixed(4)),
    hits: withMemoryStats.hits,
    total: withMemory.length,
  };
};

if (require.main === module) {
  const summary = runExperiment();
  console.log('ODMA Experiment Summary');
  console.log(JSON.stringify(summary, null, 2));
}
