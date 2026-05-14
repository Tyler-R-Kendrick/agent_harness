export type DriftSeverity = 'low' | 'medium' | 'high';
export type AnswerMode = 'normal' | 'grounded' | 'strict' | 'abstain';

export interface TurnContext {
  readonly text: string;
  readonly retrievalVolatility: number;
  readonly contradictionSignals: number;
}

export interface CandidateAnswer {
  readonly content: string;
  readonly evidenceCount: number;
  readonly confidence: number;
  readonly contradictionFlag: boolean;
}

export interface Policy {
  readonly mode: AnswerMode;
  readonly minEvidence: number;
  readonly maxConfidenceWithoutEvidence: number;
}

export interface RunResult {
  readonly severity: DriftSeverity;
  readonly policy: Policy;
  readonly accepted: boolean;
  readonly finalMode: AnswerMode;
  readonly retries: number;
}

export function classifyDrift(ctx: TurnContext): DriftSeverity {
  const score = ctx.retrievalVolatility + ctx.contradictionSignals;
  if (score >= 6) {
    return 'high';
  }
  if (score >= 3) {
    return 'medium';
  }
  return 'low';
}

export function selectPolicy(severity: DriftSeverity): Policy {
  if (severity === 'high') {
    return { mode: 'strict', minEvidence: 2, maxConfidenceWithoutEvidence: 0.4 };
  }
  if (severity === 'medium') {
    return { mode: 'grounded', minEvidence: 1, maxConfidenceWithoutEvidence: 0.6 };
  }
  return { mode: 'normal', minEvidence: 0, maxConfidenceWithoutEvidence: 0.85 };
}

export function verify(answer: CandidateAnswer, policy: Policy): boolean {
  if (answer.contradictionFlag) {
    return false;
  }

  if (answer.evidenceCount < policy.minEvidence) {
    return false;
  }

  return !(answer.evidenceCount === 0 && answer.confidence > policy.maxConfidenceWithoutEvidence);
}

export function runDriftLoop(
  ctx: TurnContext,
  generate: (mode: AnswerMode) => CandidateAnswer,
  maxRetries = 2,
): RunResult {
  const severity = classifyDrift(ctx);
  const policy = selectPolicy(severity);

  let retries = 0;
  let mode: AnswerMode = policy.mode;

  while (retries <= maxRetries) {
    const candidate = generate(mode);
    const ok = verify(candidate, policy);
    if (ok) {
      return { severity, policy, accepted: true, finalMode: mode, retries };
    }

    retries += 1;
    mode = retries > maxRetries ? 'abstain' : 'strict';
  }

  return { severity, policy, accepted: false, finalMode: 'abstain', retries };
}
