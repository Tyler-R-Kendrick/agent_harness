import type { ChatMessage } from '../types';
import type { ProcessEntry } from './processLog';

export type TrajectoryCriticAction = 'continue' | 'stop' | 'retry' | 'branch' | 'human-review';

export interface TrajectoryCriticSettings {
  enabled: boolean;
  retryThreshold: number;
  branchThreshold: number;
  stopThreshold: number;
  humanReviewThreshold: number;
}

export interface TrajectoryCriticReason {
  kind: 'confidence' | 'concern';
  code: string;
  label: string;
  weight: number;
}

export interface TrajectoryCriticResult {
  enabled: boolean;
  score: number;
  action: TrajectoryCriticAction;
  summary: string;
  reasons: TrajectoryCriticReason[];
}

export interface EvaluateTrajectoryInput {
  entries: readonly ProcessEntry[];
  message?: ChatMessage;
  settings?: TrajectoryCriticSettings;
}

export const DEFAULT_TRAJECTORY_CRITIC_SETTINGS: TrajectoryCriticSettings = {
  enabled: true,
  retryThreshold: 0.58,
  branchThreshold: 0.44,
  stopThreshold: 0.24,
  humanReviewThreshold: 0.68,
};

const ERROR_TERMS = /\b(error|failed|failure|exception|timeout|denied|rejected)\b/i;
const ZERO_PROBLEM_COUNTER_TERMS = /\b(?:0|zero)\s+(?:errors?|fail(?:ed|ures?)|exceptions?|timeouts?|denials?|rejections?)\b/gi;
const NEGATED_PROBLEM_TERMS = /\b(?:no|without)\s+(?:errors?|failures?|failed(?:\s+\w+)?|exceptions?|timeouts?|denials?|rejections?)\b/gi;

export function isTrajectoryCriticSettings(value: unknown): value is TrajectoryCriticSettings {
  if (!isRecord(value)) return false;
  const candidate = value as Partial<TrajectoryCriticSettings>;
  if (typeof candidate.enabled !== 'boolean') return false;
  const thresholds = [
    candidate.stopThreshold,
    candidate.branchThreshold,
    candidate.retryThreshold,
    candidate.humanReviewThreshold,
  ];
  if (!thresholds.every(isThreshold)) return false;
  return (
    candidate.stopThreshold! <= candidate.branchThreshold!
    && candidate.branchThreshold! <= candidate.retryThreshold!
    && candidate.retryThreshold! <= candidate.humanReviewThreshold!
  );
}

export function normalizeTrajectoryCriticSettings(value: unknown): TrajectoryCriticSettings {
  return isTrajectoryCriticSettings(value) ? value : DEFAULT_TRAJECTORY_CRITIC_SETTINGS;
}

export function evaluateTrajectory({
  entries,
  message,
  settings = DEFAULT_TRAJECTORY_CRITIC_SETTINGS,
}: EvaluateTrajectoryInput): TrajectoryCriticResult {
  const normalizedSettings = normalizeTrajectoryCriticSettings(settings);
  if (!normalizedSettings.enabled) {
    return {
      enabled: false,
      score: 1,
      action: 'continue',
      summary: 'Trajectory critic is disabled.',
      reasons: [],
    };
  }

  const reasons = buildReasons(entries, message);
  const score = roundScore(clampScore(
    reasons.reduce((current, reason) => (
      reason.kind === 'confidence'
        ? current + reason.weight
        : current - reason.weight
    ), 0.72),
  ));
  const concerns = reasons.filter((reason) => reason.kind === 'concern');
  const action = selectAction(score, concerns.length > 0, normalizedSettings);

  return {
    enabled: true,
    score,
    action,
    summary: summarizeAction(action, score),
    reasons,
  };
}

function buildReasons(entries: readonly ProcessEntry[], message?: ChatMessage): TrajectoryCriticReason[] {
  const reasons: TrajectoryCriticReason[] = [];
  const hasTerminalSuccess = entries.some((entry) => ['completion', 'result', 'commit'].includes(entry.kind));
  const hasUsefulToolResult = entries.some((entry) => (
    entry.kind === 'tool-result'
    && !entryHasErrorText(entry)
    && Boolean((entry.transcript ?? entry.summary).trim())
  ));
  const hasApprovingVote = entries.some((entry) => entry.kind === 'vote' && voteApproves(entry));
  const hasHealthyBranching = new Set(entries.map((entry) => entry.branchId).filter(Boolean)).size > 1
    && !entries.some((entry) => entry.status === 'failed');

  if (hasTerminalSuccess) {
    reasons.push(reason('confidence', 'terminal-success', 'Terminal success', 0.08));
  }
  if (hasUsefulToolResult) {
    reasons.push(reason('confidence', 'useful-tool-result', 'Useful tool result', 0.06));
  }
  if (hasApprovingVote) {
    reasons.push(reason('confidence', 'vote-approved', 'Voter approved', 0.04));
  }
  if (hasHealthyBranching) {
    reasons.push(reason('confidence', 'healthy-branching', 'Healthy branching', 0.03));
  }

  if (entries.some((entry) => entry.status === 'failed')) {
    reasons.push(reason('concern', 'failed-entry', 'Failed process entry', 0.28));
  }
  if (entries.some((entry) => entry.kind === 'abort')) {
    reasons.push(reason('concern', 'abort', 'Abort event', 0.18));
  }
  if (entries.some((entry) => entry.kind === 'vote' && voteRejects(entry))) {
    reasons.push(reason('concern', 'vote-rejected', 'Voter rejected', 0.14));
  }
  if (entries.some((entry) => entry.kind === 'tool-result' && entryHasErrorText(entry))) {
    reasons.push(reason('concern', 'tool-error', 'Tool error', 0.16));
  }
  if (messageIsFinished(message) && entries.filter((entry) => entry.status === 'active').length > 1) {
    reasons.push(reason('concern', 'stale-active', 'Stale active entries', 0.10));
  }
  if (message?.isError === true) {
    reasons.push(reason('concern', 'assistant-error', 'Assistant error state', 0.08));
  }

  return reasons;
}

function selectAction(
  score: number,
  hasConcern: boolean,
  settings: TrajectoryCriticSettings,
): TrajectoryCriticAction {
  if (score <= settings.stopThreshold) return 'stop';
  if (score <= settings.branchThreshold) return 'branch';
  if (score <= settings.retryThreshold) return 'retry';
  if (hasConcern && score < settings.humanReviewThreshold) return 'human-review';
  return 'continue';
}

function summarizeAction(action: TrajectoryCriticAction, score: number): string {
  const percent = Math.round(score * 100);
  switch (action) {
    case 'stop':
      return `Stop recommended at ${percent}% confidence.`;
    case 'branch':
      return `Branch into an alternative attempt at ${percent}% confidence.`;
    case 'retry':
      return `Retry the current path at ${percent}% confidence.`;
    case 'human-review':
      return `Request human review at ${percent}% confidence.`;
    case 'continue':
      return `Continue with ${percent}% confidence.`;
  }
}

function reason(
  kind: TrajectoryCriticReason['kind'],
  code: string,
  label: string,
  weight: number,
): TrajectoryCriticReason {
  return { kind, code, label, weight };
}

function entryHasErrorText(entry: ProcessEntry): boolean {
  const text = `${entry.summary}\n${entry.transcript ?? ''}`
    .replace(ZERO_PROBLEM_COUNTER_TERMS, '')
    .replace(NEGATED_PROBLEM_TERMS, '');
  return ERROR_TERMS.test(text);
}

function voteApproves(entry: ProcessEntry): boolean {
  return payloadApprove(entry.payload) === true || /\b(approved|approve|yes|pass)\b/i.test(`${entry.summary}\n${entry.transcript ?? ''}`);
}

function voteRejects(entry: ProcessEntry): boolean {
  return payloadApprove(entry.payload) === false || /\b(rejected|reject|no|fail|incorrect)\b/i.test(`${entry.summary}\n${entry.transcript ?? ''}`);
}

function payloadApprove(payload: unknown): boolean | undefined {
  if (!isRecord(payload) || typeof payload.approve !== 'boolean') return undefined;
  return payload.approve;
}

function messageIsFinished(message: ChatMessage | undefined): boolean {
  return message?.status === 'complete' || message?.status === 'error' || message?.statusText === 'stopped';
}

function isThreshold(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(1, score));
}

function roundScore(score: number): number {
  return Math.round(score * 100) / 100;
}
