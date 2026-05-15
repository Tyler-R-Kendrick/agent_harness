export type FailureCode =
  | 'QUALITY_LEAK'
  | 'QUALITY_SCHEMA'
  | 'QUALITY_SPECIFICITY'
  | 'WEAK_TOO_STRONG'
  | 'GAP_TOO_SMALL'
  | 'ROUND_BUDGET_EXHAUSTED';

export interface CandidateSample {
  context: string;
  question: string;
  referenceAnswer: string;
  rubricWeights: number[];
}

export interface RoundResult {
  round: number;
  qualityPassed: boolean;
  weakScore?: number;
  strongScore?: number;
  gap?: number;
  accepted: boolean;
  failureCodes: FailureCode[];
}

export interface LoopConfig {
  maxRounds: number;
  weakMax: number;
  minGap: number;
}

const defaultConfig: LoopConfig = {
  maxRounds: 5,
  weakMax: 65,
  minGap: 20,
};

function buildCandidate(doc: string, round: number): CandidateSample {
  return {
    context: `Context ${round}: ${doc}`,
    question: round === 1 ? 'Generic ML question?' : `Doc-specific question for: ${doc}?`,
    referenceAnswer: `Reference answer for ${doc}`,
    rubricWeights: round === 2 ? [20, 20, 20] : [30, 30, 40],
  };
}

function qualityVerify(sample: CandidateSample): FailureCode[] {
  const failures: FailureCode[] = [];
  if (sample.question.includes('Generic')) failures.push('QUALITY_SPECIFICITY');
  if (sample.rubricWeights.reduce((a, b) => a + b, 0) !== 100) failures.push('QUALITY_SCHEMA');
  if (sample.context.includes(sample.referenceAnswer.slice(0, 12))) failures.push('QUALITY_LEAK');
  return failures;
}

function scoreWeak(round: number): number {
  return round >= 3 ? 52 : 72;
}

function scoreStrong(round: number): number {
  return round >= 3 ? 84 : 76;
}

export function runWsSDL(doc: string, config: LoopConfig = defaultConfig): RoundResult[] {
  const rounds: RoundResult[] = [];

  for (let round = 1; round <= config.maxRounds; round += 1) {
    const sample = buildCandidate(doc, round);
    const qualityFailures = qualityVerify(sample);

    if (qualityFailures.length > 0) {
      rounds.push({
        round,
        qualityPassed: false,
        accepted: false,
        failureCodes: qualityFailures,
      });
      continue;
    }

    const weakScore = scoreWeak(round);
    const strongScore = scoreStrong(round);
    const gap = strongScore - weakScore;

    const failureCodes: FailureCode[] = [];
    if (weakScore > config.weakMax) failureCodes.push('WEAK_TOO_STRONG');
    if (gap < config.minGap) failureCodes.push('GAP_TOO_SMALL');

    const accepted = failureCodes.length === 0;
    rounds.push({
      round,
      qualityPassed: true,
      weakScore,
      strongScore,
      gap,
      accepted,
      failureCodes,
    });

    if (accepted) return rounds;
  }

  rounds.push({
    round: config.maxRounds + 1,
    qualityPassed: false,
    accepted: false,
    failureCodes: ['ROUND_BUDGET_EXHAUSTED'],
  });

  return rounds;
}

export function runDemoExperiment(): { accepted: number; rejected: number; details: RoundResult[][] } {
  const docs = ['Paper A: retrieval-augmented planning', 'Paper B: synthetic benchmark generation'];
  const details = docs.map((doc) => runWsSDL(doc));

  const accepted = details.filter((d) => d.some((r) => r.accepted)).length;
  const rejected = details.length - accepted;

  return { accepted, rejected, details };
}
