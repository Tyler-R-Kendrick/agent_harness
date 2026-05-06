import type { ChatMessage } from '../types';
import type { ProcessEntry } from './processLog';

export type EvaluationScorerId =
  | 'trace-coverage'
  | 'tool-reliability'
  | 'artifact-evidence'
  | 'latency-budget';

export type EvaluationScorerStatus = 'passing' | 'warning' | 'failing';

export interface EvaluationScorerResult {
  id: EvaluationScorerId;
  label: string;
  score: number;
  status: EvaluationScorerStatus;
  summary: string;
  evidenceEntryIds: string[];
}

export interface EvaluationDatasetCase {
  caseId: string;
  runId: string;
  inputSummary: string;
  outputSummary: string;
  traceEntryCount: number;
  artifactCount: number;
}

export interface EvaluationExperimentSummary {
  experimentId: string;
  datasetId: 'agent-browser-live-runs';
  aggregateScore: number;
  passingCount: number;
  failingCount: number;
}

export interface EvaluationRunScore {
  overallScore: number;
  verdict: EvaluationScorerStatus | 'needs-review';
  scorers: EvaluationScorerResult[];
  datasetCase: EvaluationDatasetCase;
  experiment: EvaluationExperimentSummary;
}

export interface ScoreEvaluationRunInput {
  message: ChatMessage;
  entries: ProcessEntry[];
  latencyBudgetMs?: number;
}

const DEFAULT_LATENCY_BUDGET_MS = 60_000;
const EVIDENCE_PATTERN = /\b(artifact|browser|diff|dom|evidence|screenshot|trace)\b/i;

function toStatus(score: number): EvaluationScorerStatus {
  if (score >= 80) return 'passing';
  if (score >= 50) return 'warning';
  return 'failing';
}

function compact(value: string, fallback: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  return normalized.length <= 140 ? normalized : `${normalized.slice(0, 137)}...`;
}

function stringifyPayload(payload: unknown): string {
  if (payload === undefined || payload === null) return '';
  if (typeof payload === 'string') return payload;
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

function entryHasDetail(entry: ProcessEntry): boolean {
  return Boolean(entry.transcript?.trim()) || entry.payload !== undefined;
}

function scoreTraceCoverage(entries: ProcessEntry[]): EvaluationScorerResult {
  const evidenceEntryIds = entries.filter(entryHasDetail).map((entry) => entry.id);
  const score = entries.length === 0
    ? 0
    : Math.round(((entries.length + evidenceEntryIds.length) / (entries.length * 2)) * 100);
  return {
    id: 'trace-coverage',
    label: 'Trace coverage',
    score,
    status: toStatus(score),
    summary: entries.length === 0
      ? 'No process events were captured for this run.'
      : `${evidenceEntryIds.length}/${entries.length} process events include transcript or payload detail.`,
    evidenceEntryIds,
  };
}

function scoreToolReliability(entries: ProcessEntry[]): EvaluationScorerResult {
  const toolEntries = entries.filter((entry) => entry.kind === 'tool-call');
  const failedToolEntries = toolEntries.filter((entry) => entry.status === 'failed');
  const score = toolEntries.length === 0
    ? 100
    : Math.round(((toolEntries.length - failedToolEntries.length) / toolEntries.length) * 100);
  return {
    id: 'tool-reliability',
    label: 'Tool reliability',
    score,
    status: failedToolEntries.length > 0 ? 'failing' : toStatus(score),
    summary: toolEntries.length === 0
      ? 'No tool calls were required for this run.'
      : `${toolEntries.length - failedToolEntries.length}/${toolEntries.length} tool calls completed without failure.`,
    evidenceEntryIds: failedToolEntries.length > 0
      ? failedToolEntries.map((entry) => entry.id)
      : toolEntries.map((entry) => entry.id),
  };
}

function scoreArtifactEvidence(message: ChatMessage, entries: ProcessEntry[]): EvaluationScorerResult {
  const cardCount = message.cards?.length ?? 0;
  const evidenceEntryIds = entries
    .filter((entry) => EVIDENCE_PATTERN.test(`${entry.summary} ${entry.transcript ?? ''} ${stringifyPayload(entry.payload)}`))
    .map((entry) => entry.id);
  const evidenceCount = cardCount + evidenceEntryIds.length;
  const score = evidenceCount > 0 ? 100 : 40;
  return {
    id: 'artifact-evidence',
    label: 'Artifact evidence',
    score,
    status: toStatus(score),
    summary: evidenceCount > 0
      ? `${evidenceCount} artifact or evidence reference${evidenceCount === 1 ? '' : 's'} attached to the run.`
      : 'No artifact, screenshot, browser, diff, or evidence reference was attached.',
    evidenceEntryIds,
  };
}

function runDurationMs(entries: ProcessEntry[]): number {
  if (entries.length === 0) return 0;
  const earliest = Math.min(...entries.map((entry) => entry.ts));
  const latest = Math.max(...entries.map((entry) => entry.endedAt ?? entry.ts));
  return Math.max(0, latest - earliest);
}

function scoreLatencyBudget(entries: ProcessEntry[], latencyBudgetMs: number): EvaluationScorerResult {
  const durationMs = runDurationMs(entries);
  const score = durationMs <= latencyBudgetMs
    ? 100
    : Math.max(0, Math.round((latencyBudgetMs / durationMs) * 100));
  return {
    id: 'latency-budget',
    label: 'Latency budget',
    score,
    status: toStatus(score),
    summary: `${Math.round(durationMs / 1000)}s run duration against ${Math.round(latencyBudgetMs / 1000)}s budget.`,
    evidenceEntryIds: entries.map((entry) => entry.id),
  };
}

function buildDatasetCase(message: ChatMessage, entries: ProcessEntry[], artifactCount: number): EvaluationDatasetCase {
  return {
    caseId: `eval-case:${message.id}`,
    runId: message.id,
    inputSummary: 'Assistant turn',
    outputSummary: compact(message.streamedContent ?? message.content, message.status ?? 'Assistant response'),
    traceEntryCount: entries.length,
    artifactCount,
  };
}

function buildExperiment(message: ChatMessage, overallScore: number, scorers: EvaluationScorerResult[]): EvaluationExperimentSummary {
  const failingCount = scorers.filter((scorer) => scorer.status === 'failing').length;
  return {
    experimentId: `live:${message.id}`,
    datasetId: 'agent-browser-live-runs',
    aggregateScore: overallScore,
    passingCount: scorers.length - failingCount,
    failingCount,
  };
}

export function scoreEvaluationRun({
  message,
  entries,
  latencyBudgetMs = DEFAULT_LATENCY_BUDGET_MS,
}: ScoreEvaluationRunInput): EvaluationRunScore {
  const orderedEntries = [...entries].sort((left, right) => {
    if (left.ts !== right.ts) return left.ts - right.ts;
    return left.position - right.position;
  });
  const scorers = [
    scoreTraceCoverage(orderedEntries),
    scoreToolReliability(orderedEntries),
    scoreArtifactEvidence(message, orderedEntries),
    scoreLatencyBudget(orderedEntries, latencyBudgetMs),
  ];
  const overallScore = Math.round(scorers.reduce((total, scorer) => total + scorer.score, 0) / scorers.length);
  const hasFailure = message.isError === true || scorers.some((scorer) => scorer.status === 'failing');
  const verdict: EvaluationRunScore['verdict'] = hasFailure
    ? 'needs-review'
    : overallScore >= 80
      ? 'passing'
      : 'warning';
  const artifactCount = (message.cards?.length ?? 0)
    + (scorers.find((scorer) => scorer.id === 'artifact-evidence')?.evidenceEntryIds.length ?? 0);
  return {
    overallScore,
    verdict,
    scorers,
    datasetCase: buildDatasetCase(message, orderedEntries, artifactCount),
    experiment: buildExperiment(message, overallScore, scorers),
  };
}
