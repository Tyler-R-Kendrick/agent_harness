export interface AdversaryAgentSettings {
  enabled: boolean;
  maxCandidates: number;
  rerunOnAdversaryWin: boolean;
  preserveJudgeFeedback: boolean;
  stealthVoterLabels: boolean;
}

export interface AdversaryCandidatePlanInput {
  task: string;
  evalCriteria: readonly string[];
  trajectory: readonly string[];
  circularFailures: readonly string[];
  settings?: AdversaryAgentSettings;
}

export interface AdversaryCandidate {
  id: string;
  kind: 'adversary';
  attackGoal: string;
  judgeBlindSpot: string;
  feedbackHook: string;
}

export interface AdversaryCandidatePlan {
  enabled: boolean;
  maxCandidates: number;
  contextDigest: string;
  candidates: AdversaryCandidate[];
}

export interface AdversaryJudgeFeedbackInput {
  voterId: string;
  selectedCandidateId: string;
  selectedCandidateKind: 'adversary' | 'happy-path';
  reason: string;
  settings?: AdversaryAgentSettings;
}

export interface AdversaryJudgeFeedback {
  adversaryWon: boolean;
  shouldRerun: boolean;
  summary: string;
  feedbackForNextIteration: string;
}

export const DEFAULT_ADVERSARY_AGENT_SETTINGS: AdversaryAgentSettings = {
  enabled: true,
  maxCandidates: 3,
  rerunOnAdversaryWin: true,
  preserveJudgeFeedback: true,
  stealthVoterLabels: true,
};

const MAX_CANDIDATES_LIMIT = 5;

export function isAdversaryAgentSettings(value: unknown): value is AdversaryAgentSettings {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean'
    && typeof value.maxCandidates === 'number'
    && Number.isFinite(value.maxCandidates)
    && typeof value.rerunOnAdversaryWin === 'boolean'
    && typeof value.preserveJudgeFeedback === 'boolean'
    && typeof value.stealthVoterLabels === 'boolean'
  );
}

export function normalizeAdversaryAgentSettings(
  settings: AdversaryAgentSettings = DEFAULT_ADVERSARY_AGENT_SETTINGS,
): AdversaryAgentSettings {
  return {
    enabled: settings.enabled,
    maxCandidates: clampInteger(settings.maxCandidates, 1, MAX_CANDIDATES_LIMIT),
    rerunOnAdversaryWin: settings.rerunOnAdversaryWin,
    preserveJudgeFeedback: settings.preserveJudgeFeedback,
    stealthVoterLabels: settings.stealthVoterLabels,
  };
}

export function planAdversaryCandidates(input: AdversaryCandidatePlanInput): AdversaryCandidatePlan {
  const settings = normalizeAdversaryAgentSettings(input.settings);
  const contextDigest = buildContextDigest(input);

  if (!settings.enabled) {
    return {
      enabled: false,
      maxCandidates: 1,
      contextDigest,
      candidates: [{
        id: 'adv-1',
        kind: 'adversary',
        attackGoal: 'Adversary generation is disabled by operator settings.',
        judgeBlindSpot: 'No adversarial candidate should be submitted while disabled.',
        feedbackHook: 'Enable adversary candidate generation to run a red-team pass.',
      }],
    };
  }

  return {
    enabled: true,
    maxCandidates: settings.maxCandidates,
    contextDigest,
    candidates: Array.from({ length: settings.maxCandidates }, (_, index) => {
      const criterion = pickOrFallback(input.evalCriteria, index, 'the stated evaluation criteria');
      const trajectory = pickOrFallback(input.trajectory, index, 'the current AgentBus trajectory');
      const circularFailure = pickOrFallback(input.circularFailures, index, 'a repeated reasoning loop');
      return {
        id: `adv-${index + 1}`,
        kind: 'adversary' as const,
        attackGoal: `Exploit judge preference around ${criterion}.`,
        judgeBlindSpot: `Make the candidate look consistent with ${trajectory} while hiding the failure mode.`,
        feedbackHook: `If selected, rerun with feedback about ${circularFailure}.`,
      };
    }),
  };
}

export function recordAdversaryJudgeFeedback(input: AdversaryJudgeFeedbackInput): AdversaryJudgeFeedback {
  const settings = normalizeAdversaryAgentSettings(input.settings);
  const adversaryWon = input.selectedCandidateKind === 'adversary';
  const selectedLabel = adversaryWon ? 'Adversary' : 'Happy-path';
  const summary = adversaryWon
    ? `Adversary candidate ${input.selectedCandidateId} fooled ${input.voterId}.`
    : `Happy-path candidate ${input.selectedCandidateId} passed ${input.voterId}.`;
  const feedbackForNextIteration = adversaryWon
    ? `Judge ${input.voterId} selected adversary candidate ${input.selectedCandidateId}. Reason: ${input.reason}. Rerun the happy-path answer with this failure mode explicit.`
    : `Judge ${input.voterId} selected ${selectedLabel.toLowerCase()} candidate ${input.selectedCandidateId}. Reason: ${input.reason}. Preserve the winning evidence pattern.`;

  return {
    adversaryWon,
    shouldRerun: adversaryWon && settings.rerunOnAdversaryWin,
    summary,
    feedbackForNextIteration: settings.preserveJudgeFeedback
      ? feedbackForNextIteration
      : 'Judge feedback preservation is disabled by operator settings.',
  };
}

function buildContextDigest(input: AdversaryCandidatePlanInput): string {
  return [
    `Task: ${fallbackText(input.task, 'No task supplied')}`,
    `Eval criteria: ${joinList(input.evalCriteria, 'none supplied')}`,
    `AgentBus trajectory: ${joinList(input.trajectory, 'none supplied')}`,
    `Circular failures: ${joinList(input.circularFailures, 'none identified')}`,
  ].join('\n');
}

function joinList(values: readonly string[], fallback: string): string {
  const cleaned = values.map((entry) => entry.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned.join('; ') : fallback;
}

function fallbackText(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function pickOrFallback(values: readonly string[], index: number, fallback: string): string {
  const cleaned = values.map((entry) => entry.trim()).filter(Boolean);
  if (cleaned.length === 0) return fallback;
  return cleaned[index % cleaned.length];
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
