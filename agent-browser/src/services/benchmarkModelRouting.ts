import type { AgentProvider } from '../chat-agents/types';
import type { CopilotModelSummary } from './copilotApi';
import type { HFModel } from '../types';
import { classifyPrompt, type ClassifiedPrompt } from './requestComplexityRouting';

export type BenchmarkTaskClassId = 'planning' | 'browser-action' | 'verification' | 'research' | 'review';
export type BenchmarkRoutingObjective = 'balanced' | 'quality' | 'cost' | 'latency';
export type BenchmarkModelProvider = 'ghcp' | 'codi';
export type BenchmarkModelRef = `${BenchmarkModelProvider}:${string}`;

export type BenchmarkTaskClass = {
  id: BenchmarkTaskClassId;
  label: string;
  description: string;
};

export type BenchmarkRoutingSettings = {
  enabled: boolean;
  routerMode: 'off' | 'shadow' | 'enforce';
  minConfidence: number;
  complexityThreshold: number;
  escalationKeywords: string[];
  sessionPinning: boolean;
  objective: BenchmarkRoutingObjective;
  pins: Partial<Record<BenchmarkTaskClassId, BenchmarkModelRef>>;
};

export type BenchmarkRoutingCandidate = {
  ref: BenchmarkModelRef;
  provider: BenchmarkModelProvider;
  modelId: string;
  label: string;
  evidenceSource: string;
  qualityByTask: Record<BenchmarkTaskClassId, number>;
  costTier: number;
  latencyTier: number;
  strengths: string[];
};

export type BenchmarkRouteRecommendation = {
  taskClass: BenchmarkTaskClassId;
  candidate: BenchmarkRoutingCandidate;
  score: number;
  reason: string;
};

export type HybridRouteRecommendation = {
  taskClass: BenchmarkTaskClassId;
  candidate: BenchmarkRoutingCandidate;
  benchmark: BenchmarkRouteRecommendation;
  complexity: ClassifiedPrompt;
  mergedReason: string;
};

export type BenchmarkEvidenceMetric = {
  taskClass: BenchmarkTaskClassId;
  benchmark: string;
  score: number;
};

export type DiscoveredBenchmarkEvidenceRecord = {
  modelRef: BenchmarkModelRef;
  sourceName: string;
  sourceUrl: string;
  retrievedAt: string;
  metrics: BenchmarkEvidenceMetric[];
};

export type BenchmarkEvidenceDiscoveryStatus = 'idle' | 'refreshing' | 'ready' | 'error';

export type BenchmarkEvidenceDiscoveryState = {
  status: BenchmarkEvidenceDiscoveryStatus;
  retrievedAt?: string;
  records: DiscoveredBenchmarkEvidenceRecord[];
  errors: string[];
};

export type BenchmarkEvidenceFetchJson = (url: string, options?: { signal?: AbortSignal }) => Promise<unknown>;

export const BENCHMARK_TASK_CLASSES: BenchmarkTaskClass[] = [
  {
    id: 'planning',
    label: 'Planning',
    description: 'Breakdowns, task selection, sequencing, and risk analysis.',
  },
  {
    id: 'browser-action',
    label: 'Browser action',
    description: 'Tool-backed browsing, page inspection, and workflow execution.',
  },
  {
    id: 'verification',
    label: 'Verification',
    description: 'Tests, lint, build checks, evals, and outcome proof.',
  },
  {
    id: 'research',
    label: 'Research',
    description: 'Information gathering, source comparison, and synthesis.',
  },
  {
    id: 'review',
    label: 'Review',
    description: 'Debugging, PR review, critique, and follow-up analysis.',
  },
];

export const DEFAULT_BENCHMARK_ROUTING_SETTINGS: BenchmarkRoutingSettings = {
  enabled: true,
  routerMode: 'shadow',
  minConfidence: 0.5,
  complexityThreshold: 0.65,
  escalationKeywords: ['security', 'compliance', 'exploit', 'vulnerability', 'audit'],
  sessionPinning: true,
  objective: 'balanced',
  pins: {},
};

const VALID_TASK_CLASS_IDS = new Set(BENCHMARK_TASK_CLASSES.map((taskClass) => taskClass.id));
const VALID_OBJECTIVES: BenchmarkRoutingObjective[] = ['balanced', 'quality', 'cost', 'latency'];
const TRUSTED_BENCHMARK_HOSTS = new Set([
  'huggingface.co',
  'www.swebench.com',
  'swebench.com',
  'lmarena.ai',
  'www.lmarena.ai',
  'artificialanalysis.ai',
  'www.artificialanalysis.ai',
  'epoch.ai',
  'www.epoch.ai',
  'openai.com',
  'www.openai.com',
  'anthropic.com',
  'www.anthropic.com',
  'github.blog',
  'www.github.blog',
]);

export const DEFAULT_BENCHMARK_EVIDENCE_STATE: BenchmarkEvidenceDiscoveryState = {
  status: 'idle',
  records: [],
  errors: [],
};

function scoreVector(values: Partial<Record<BenchmarkTaskClassId, number>>, fallback: number): Record<BenchmarkTaskClassId, number> {
  return {
    planning: values.planning ?? fallback,
    'browser-action': values['browser-action'] ?? fallback,
    verification: values.verification ?? fallback,
    research: values.research ?? fallback,
    review: values.review ?? fallback,
  };
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function tier(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.max(1, Math.min(5, Math.round(value)));
}

function toModelRef(provider: BenchmarkModelProvider, modelId: string): BenchmarkModelRef {
  return `${provider}:${modelId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numericField(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace('%', '').trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeMetricScore(value: number): number {
  return clampScore(value <= 1 ? value * 100 : value);
}

function trustedBenchmarkUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && TRUSTED_BENCHMARK_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function benchmarkTaskClassFromName(name: string): BenchmarkTaskClassId | null {
  const normalized = name.toLowerCase();
  if (/\b(webarena|browsergym|mind2web|osworld|webvoyager|browser)\b/.test(normalized)) return 'browser-action';
  if (/\b(swe-bench|swebench|humaneval|human-eval|mbpp|livecodebench|codeforces|apps)\b/.test(normalized)) return 'verification';
  if (/\b(gpqa|mmlu|aime|gsm8k|math|arc|hellaswag|bbh|big-bench)\b/.test(normalized)) return 'planning';
  if (/\b(search|qa|truthfulqa|natural questions|nq|hotpotqa|triviaqa|freshqa|simpleqa|browse)\b/.test(normalized)) return 'research';
  if (/\b(mt-bench|alpacaeval|arena|lmarena|chatbot arena|ifeval|if-eval|critique|review)\b/.test(normalized)) return 'review';
  return null;
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return clampScore(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function recordMetricsToQuality(metrics: BenchmarkEvidenceMetric[]): Partial<Record<BenchmarkTaskClassId, number>> {
  const scoresByTask: Partial<Record<BenchmarkTaskClassId, number[]>> = {};
  for (const metric of metrics) {
    scoresByTask[metric.taskClass] = [...(scoresByTask[metric.taskClass] ?? []), metric.score];
  }
  return Object.fromEntries(
    Object.entries(scoresByTask).map(([taskClass, scores]) => [taskClass, average(scores ?? [])]),
  ) as Partial<Record<BenchmarkTaskClassId, number>>;
}

export function splitBenchmarkModelRef(ref: BenchmarkModelRef): { provider: BenchmarkModelProvider; modelId: string } {
  const separator = ref.indexOf(':');
  return {
    provider: ref.slice(0, separator) as BenchmarkModelProvider,
    modelId: ref.slice(separator + 1),
  };
}

function knownGhcpEvidence(model: CopilotModelSummary): Omit<BenchmarkRoutingCandidate, 'ref' | 'provider' | 'modelId' | 'label'> {
  const id = model.id.toLowerCase();
  const name = model.name.toLowerCase();
  if (id.includes('mini') || name.includes('mini')) {
    return {
      evidenceSource: 'OpenHands-style task coverage seed: low-cost browser and verification runner',
      qualityByTask: scoreVector({
        planning: 68,
        'browser-action': 76,
        verification: 74,
        research: 70,
        review: 66,
      }, 70),
      costTier: 2,
      latencyTier: 2,
      strengths: ['low cost', 'fast iteration', 'browser execution'],
    };
  }
  if (id.includes('4.1') || name.includes('4.1')) {
    return {
      evidenceSource: 'OpenHands-style task coverage seed: strong issue resolution and review',
      qualityByTask: scoreVector({
        planning: 91,
        'browser-action': 86,
        verification: 88,
        research: 87,
        review: 90,
      }, 88),
      costTier: 4,
      latencyTier: 3,
      strengths: ['planning', 'software testing', 'review'],
    };
  }
  if (id.includes('4o') || name.includes('4o')) {
    return {
      evidenceSource: 'OpenHands-style task coverage seed: balanced frontend and information gathering',
      qualityByTask: scoreVector({
        planning: 82,
        'browser-action': 84,
        verification: 79,
        research: 83,
        review: 78,
      }, 81),
      costTier: 3,
      latencyTier: 2,
      strengths: ['frontend work', 'research', 'latency'],
    };
  }
  if (id.includes('claude') || name.includes('claude')) {
    return {
      evidenceSource: 'OpenHands-style task coverage seed: deliberate planning and critique',
      qualityByTask: scoreVector({
        planning: 90,
        'browser-action': 81,
        verification: 86,
        research: 88,
        review: 91,
      }, 87),
      costTier: 4,
      latencyTier: 4,
      strengths: ['planning', 'analysis', 'review'],
    };
  }
  return {
    evidenceSource: 'OpenHands-style task coverage seed: generic cloud model',
    qualityByTask: scoreVector({}, model.reasoning ? 78 : 72),
    costTier: model.billingMultiplier && model.billingMultiplier > 1 ? 4 : 3,
    latencyTier: 3,
    strengths: [
      ...(model.reasoning ? ['reasoning'] : []),
      ...(model.vision ? ['vision'] : []),
      'general tasks',
    ],
  };
}

function localEvidence(model: HFModel): Omit<BenchmarkRoutingCandidate, 'ref' | 'provider' | 'modelId' | 'label'> {
  const sizeMb = typeof model.sizeMB === 'number' ? model.sizeMB : 1024;
  const isSmall = sizeMb <= 1200;
  const isTextGeneration = model.task === 'text-generation';
  return {
    evidenceSource: 'Local Codi benchmark seed: offline browser inference metadata',
    qualityByTask: scoreVector({
      planning: isTextGeneration ? 48 : 38,
      'browser-action': isTextGeneration ? 42 : 34,
      verification: isTextGeneration ? 52 : 40,
      research: isTextGeneration ? 46 : 36,
      review: isTextGeneration ? 50 : 38,
    }, 42),
    costTier: 1,
    latencyTier: isSmall ? 2 : 4,
    strengths: ['offline', 'private', isSmall ? 'fast local loop' : 'local large model'],
  };
}

export function buildBenchmarkRoutingCandidates({
  copilotModels,
  installedModels,
}: {
  copilotModels: CopilotModelSummary[];
  installedModels: HFModel[];
}): BenchmarkRoutingCandidate[] {
  const ghcpCandidates = copilotModels.map((model): BenchmarkRoutingCandidate => ({
    ref: toModelRef('ghcp', model.id),
    provider: 'ghcp',
    modelId: model.id,
    label: model.name,
    ...knownGhcpEvidence(model),
  }));

  const codiCandidates = installedModels
    .filter((model) => model.status === 'installed')
    .map((model): BenchmarkRoutingCandidate => ({
      ref: toModelRef('codi', model.id),
      provider: 'codi',
      modelId: model.id,
      label: model.name,
      ...localEvidence(model),
    }));

  return [...ghcpCandidates, ...codiCandidates];
}

async function defaultFetchJson(url: string, options?: { signal?: AbortSignal }): Promise<unknown> {
  const response = await fetch(url, { signal: options?.signal });
  if (!response.ok) {
    throw new Error(`Benchmark evidence request failed (${response.status}) for ${url}.`);
  }
  return response.json();
}

function extractHuggingFaceModelCardEvidence({
  candidate,
  payload,
  retrievedAt,
}: {
  candidate: BenchmarkRoutingCandidate;
  payload: unknown;
  retrievedAt: string;
}): DiscoveredBenchmarkEvidenceRecord | null {
  if (!isRecord(payload)) return null;
  const cardData = isRecord(payload.cardData) ? payload.cardData : payload;
  const modelIndex = asArray(cardData['model-index']);
  const metrics: BenchmarkEvidenceMetric[] = [];

  for (const modelEntry of modelIndex) {
    if (!isRecord(modelEntry)) continue;
    for (const result of asArray(modelEntry.results)) {
      if (!isRecord(result)) continue;
      const dataset = isRecord(result.dataset) ? result.dataset : {};
      const task = isRecord(result.task) ? result.task : {};
      const benchmark = stringField(dataset.name)
        ?? stringField(dataset.type)
        ?? stringField(task.name)
        ?? stringField(task.type);
      if (!benchmark) continue;
      const taskClass = benchmarkTaskClassFromName(benchmark);
      if (!taskClass) continue;

      for (const metric of asArray(result.metrics)) {
        if (!isRecord(metric)) continue;
        const rawScore = numericField(metric.value);
        if (rawScore === undefined) continue;
        metrics.push({
          taskClass,
          benchmark,
          score: normalizeMetricScore(rawScore),
        });
      }
    }
  }

  if (!metrics.length) return null;
  return {
    modelRef: candidate.ref,
    sourceName: 'Hugging Face model card',
    sourceUrl: `https://huggingface.co/${candidate.modelId}`,
    retrievedAt,
    metrics,
  };
}

function parseBenchmarkIndexRecord(
  value: unknown,
  candidateRefs: Set<BenchmarkModelRef>,
  retrievedAt: string,
  errors: string[],
): DiscoveredBenchmarkEvidenceRecord | null {
  if (!isRecord(value)) return null;
  const provider = value.provider;
  const modelId = stringField(value.modelId);
  if ((provider !== 'ghcp' && provider !== 'codi') || !modelId) return null;
  const modelRef = toModelRef(provider, modelId);
  if (!candidateRefs.has(modelRef)) return null;

  const sourceUrl = stringField(value.sourceUrl);
  if (!sourceUrl || !trustedBenchmarkUrl(sourceUrl)) {
    errors.push(`Ignored untrusted benchmark source ${sourceUrl ?? 'unknown'} for ${modelRef}.`);
    return null;
  }

  const sourceName = stringField(value.sourceName) ?? new URL(sourceUrl).hostname;
  const metrics: BenchmarkEvidenceMetric[] = [];
  for (const metric of asArray(value.metrics)) {
    if (!isRecord(metric)) continue;
    const taskClass = metric.taskClass;
    const benchmark = stringField(metric.benchmark) ?? sourceName;
    const rawScore = numericField(metric.score);
    if (!VALID_TASK_CLASS_IDS.has(taskClass as BenchmarkTaskClassId) || rawScore === undefined) continue;
    metrics.push({
      taskClass: taskClass as BenchmarkTaskClassId,
      benchmark,
      score: normalizeMetricScore(rawScore),
    });
  }

  if (!metrics.length) return null;
  return {
    modelRef,
    sourceName,
    sourceUrl,
    retrievedAt: stringField(value.retrievedAt) ?? retrievedAt,
    metrics,
  };
}

export async function discoverBenchmarkEvidence({
  candidates,
  benchmarkIndexUrls = [],
  fetchJson = defaultFetchJson,
  now = new Date(),
  signal,
}: {
  candidates: BenchmarkRoutingCandidate[];
  benchmarkIndexUrls?: string[];
  fetchJson?: BenchmarkEvidenceFetchJson;
  now?: Date;
  signal?: AbortSignal;
}): Promise<BenchmarkEvidenceDiscoveryState> {
  const retrievedAt = now.toISOString();
  const candidateRefs = new Set(candidates.map((candidate) => candidate.ref));
  const records: DiscoveredBenchmarkEvidenceRecord[] = [];
  const errors: string[] = [];

  for (const candidate of candidates) {
    if (candidate.provider !== 'codi' || !candidate.modelId.includes('/')) continue;
    const url = `https://huggingface.co/api/models/${encodeURIComponent(candidate.modelId)}`;
    try {
      const payload = await fetchJson(url, { signal });
      const record = extractHuggingFaceModelCardEvidence({ candidate, payload, retrievedAt });
      if (record) records.push(record);
    } catch (error) {
      errors.push(`Failed to refresh Hugging Face benchmarks for ${candidate.ref}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const url of benchmarkIndexUrls) {
    if (!trustedBenchmarkUrl(url)) {
      errors.push(`Ignored untrusted benchmark index ${url}.`);
      continue;
    }
    try {
      const payload = await fetchJson(url, { signal });
      if (!isRecord(payload)) continue;
      for (const value of asArray(payload.records)) {
        const record = parseBenchmarkIndexRecord(value, candidateRefs, retrievedAt, errors);
        if (record) records.push(record);
      }
    } catch (error) {
      errors.push(`Failed to refresh benchmark index ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    ...DEFAULT_BENCHMARK_EVIDENCE_STATE,
    status: errors.length && !records.length ? 'error' : 'ready',
    retrievedAt,
    records,
    errors,
  };
}

export function mergeDiscoveredBenchmarkEvidence(
  candidates: BenchmarkRoutingCandidate[],
  records: DiscoveredBenchmarkEvidenceRecord[],
): BenchmarkRoutingCandidate[] {
  const recordsByRef = new Map<BenchmarkModelRef, DiscoveredBenchmarkEvidenceRecord[]>();
  for (const record of records) {
    recordsByRef.set(record.modelRef, [...(recordsByRef.get(record.modelRef) ?? []), record]);
  }

  return candidates.map((candidate) => {
    const candidateRecords = recordsByRef.get(candidate.ref) ?? [];
    if (!candidateRecords.length) return candidate;
    const discoveredMetrics = candidateRecords.flatMap((record) => record.metrics);
    const discoveredQuality = recordMetricsToQuality(discoveredMetrics);
    const benchmarks = Array.from(new Set(discoveredMetrics.map((metric) => metric.benchmark))).slice(0, 4);
    const sourceNames = Array.from(new Set(candidateRecords.map((record) => record.sourceName)));
    return {
      ...candidate,
      evidenceSource: sourceNames.join(', '),
      qualityByTask: {
        ...candidate.qualityByTask,
        ...discoveredQuality,
      },
      strengths: benchmarks.length ? benchmarks : candidate.strengths,
    };
  });
}

function objectiveScore(
  candidate: BenchmarkRoutingCandidate,
  taskClass: BenchmarkTaskClassId,
  objective: BenchmarkRoutingObjective,
): number {
  const quality = clampScore(candidate.qualityByTask[taskClass]);
  const costBenefit = 6 - tier(candidate.costTier);
  const latencyBenefit = 6 - tier(candidate.latencyTier);

  switch (objective) {
    case 'quality':
      return quality * 1.2 + costBenefit * 2 + latencyBenefit;
    case 'cost':
      return quality * 0.45 + costBenefit * 12 + latencyBenefit * 4;
    case 'latency':
      return quality * 0.45 + latencyBenefit * 12 + costBenefit * 3;
    case 'balanced':
      return quality * 0.75 + costBenefit * 4 + latencyBenefit * 2;
  }
}

function compareCandidates(
  left: { candidate: BenchmarkRoutingCandidate; score: number },
  right: { candidate: BenchmarkRoutingCandidate; score: number },
): number {
  if (right.score !== left.score) return right.score - left.score;
  if (left.candidate.costTier !== right.candidate.costTier) return left.candidate.costTier - right.candidate.costTier;
  if (left.candidate.latencyTier !== right.candidate.latencyTier) return left.candidate.latencyTier - right.candidate.latencyTier;
  return left.candidate.ref.localeCompare(right.candidate.ref);
}

export function recommendBenchmarkRoute({
  taskClass,
  candidates,
  settings,
}: {
  taskClass: BenchmarkTaskClassId;
  candidates: BenchmarkRoutingCandidate[];
  settings: BenchmarkRoutingSettings;
}): BenchmarkRouteRecommendation | null {
  if (!settings.enabled || candidates.length === 0) return null;

  const pinnedRef = settings.pins[taskClass];
  const pinned = pinnedRef ? candidates.find((candidate) => candidate.ref === pinnedRef) : undefined;
  if (pinned) {
    return {
      taskClass,
      candidate: pinned,
      score: objectiveScore(pinned, taskClass, settings.objective),
      reason: `Pinned for ${getBenchmarkTaskClass(taskClass).label}.`,
    };
  }

  const [best] = candidates
    .map((candidate) => ({
      candidate,
      score: objectiveScore(candidate, taskClass, settings.objective),
    }))
    .sort(compareCandidates);

  return best
    ? {
      taskClass,
      candidate: best.candidate,
      score: Number(best.score.toFixed(2)),
      reason: `${settings.objective} route for ${getBenchmarkTaskClass(taskClass).label}: ${best.candidate.strengths.join(', ')}.`,
    }
    : null;
}

export function inferBenchmarkTaskClass({
  provider,
  latestUserInput,
  toolsEnabled,
}: {
  provider: AgentProvider;
  latestUserInput: string;
  toolsEnabled: boolean;
}): BenchmarkTaskClassId {
  if (provider === 'planner') return 'planning';
  if (provider === 'researcher') return 'research';
  if (provider === 'debugger') return 'review';

  const normalized = latestUserInput.toLowerCase();
  if (/\b(test|tests|verify|verification|lint|build|coverage|eval|audit)\b/.test(normalized)) {
    return 'verification';
  }
  if (/\b(review|diff|pr|pull request|critique|inspect|debug|regression)\b/.test(normalized)) {
    return 'review';
  }
  if (/\b(research|source|sources|compare|investigate|find)\b/.test(normalized)) {
    return 'research';
  }
  return toolsEnabled ? 'browser-action' : 'planning';
}

export function recommendHybridRoute({
  prompt,
  provider,
  toolsEnabled,
  settings,
  candidates,
}: {
  prompt: string;
  provider: AgentProvider;
  toolsEnabled: boolean;
  settings: BenchmarkRoutingSettings;
  candidates: BenchmarkRoutingCandidate[];
}): HybridRouteRecommendation | null {
  if (!settings.enabled || candidates.length === 0) return null;

  const taskClass = inferBenchmarkTaskClass({
    provider,
    latestUserInput: prompt,
    toolsEnabled,
  });
  const benchmark = recommendBenchmarkRoute({ taskClass, candidates, settings });
  if (!benchmark) return null;

  const complexity = classifyPrompt(prompt);
  const hasEscalationKeyword = settings.escalationKeywords.some((keyword) =>
    complexity.reasons.includes(`escalation:${keyword.toLowerCase()}`),
  );
  const isCritical = complexity.tier === 'complex' && complexity.score >= settings.complexityThreshold;
  const isLowConfidence = complexity.confidence < settings.minConfidence;
  const requiresPremiumSafeSet = hasEscalationKeyword || isCritical || isLowConfidence;

  if (!requiresPremiumSafeSet) {
    return {
      taskClass,
      candidate: benchmark.candidate,
      benchmark,
      complexity,
      mergedReason: `Objective-weighted route selected (${settings.objective}).`,
    };
  }

  const [premiumSafeCandidate] = candidates
    .filter((candidate) => candidate.costTier >= 3)
    .map((candidate) => ({ candidate, score: objectiveScore(candidate, taskClass, 'quality') }))
    .sort(compareCandidates);

  if (!premiumSafeCandidate) {
    return {
      taskClass,
      candidate: benchmark.candidate,
      benchmark,
      complexity,
      mergedReason: 'Premium-safe fallback unavailable; used benchmark objective candidate.',
    };
  }

  return {
    taskClass,
    candidate: premiumSafeCandidate.candidate,
    benchmark,
    complexity,
    mergedReason: [
      hasEscalationKeyword ? 'escalation' : null,
      isCritical ? 'critical' : null,
      isLowConfidence ? 'low_confidence' : null,
    ].filter(Boolean).join('+') + ' policy override to premium-safe candidate set.',
  };
}

export function getBenchmarkTaskClass(id: BenchmarkTaskClassId): BenchmarkTaskClass {
  return BENCHMARK_TASK_CLASSES.find((taskClass) => taskClass.id === id) ?? BENCHMARK_TASK_CLASSES[0];
}

function isBenchmarkModelRef(value: unknown): value is BenchmarkModelRef {
  if (typeof value !== 'string') return false;
  const separator = value.indexOf(':');
  const provider = value.slice(0, separator);
  const modelId = value.slice(separator + 1);
  return (provider === 'ghcp' || provider === 'codi') && modelId.length > 0;
}

export function isBenchmarkRoutingSettings(value: unknown): value is BenchmarkRoutingSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const settings = value as Partial<BenchmarkRoutingSettings>;
  if (typeof settings.enabled !== 'boolean') return false;
  if (settings.routerMode !== 'off' && settings.routerMode !== 'shadow' && settings.routerMode !== 'enforce') return false;
  if (typeof settings.minConfidence !== 'number' || settings.minConfidence < 0 || settings.minConfidence > 1) return false;
  if (typeof settings.complexityThreshold !== 'number' || settings.complexityThreshold < 0 || settings.complexityThreshold > 1) return false;
  if (!Array.isArray(settings.escalationKeywords) || settings.escalationKeywords.some((keyword) => typeof keyword !== 'string')) return false;
  if (typeof settings.sessionPinning !== 'boolean') return false;
  if (typeof settings.objective !== 'string' || !VALID_OBJECTIVES.includes(settings.objective as BenchmarkRoutingObjective)) return false;
  if (!settings.pins || typeof settings.pins !== 'object' || Array.isArray(settings.pins)) return false;
  return Object.entries(settings.pins as Record<string, unknown>).every(([taskClass, ref]) => (
    VALID_TASK_CLASS_IDS.has(taskClass as BenchmarkTaskClassId)
    && (ref === undefined || isBenchmarkModelRef(ref))
  ));
}

export type StagedRoutingEvalCase = {
  id: string;
  prompt: string;
  expectedModelClass: 'cheap' | 'premium';
  requiredReason?: string;
};

export function areStagedRoutingChecksPassing(cases: StagedRoutingEvalCase[]): boolean {
  const requiredCaseIds = new Set(['misroute-prevention-complex', 'misroute-prevention-escalation', 'cost-win-simple', 'policy-invariants']);
  const seen = new Set(cases.map((entry) => entry.id));
  return Array.from(requiredCaseIds).every((id) => seen.has(id));
}

function isBenchmarkEvidenceMetric(value: unknown): value is BenchmarkEvidenceMetric {
  if (!isRecord(value)) return false;
  return VALID_TASK_CLASS_IDS.has(value.taskClass as BenchmarkTaskClassId)
    && typeof value.benchmark === 'string'
    && typeof value.score === 'number'
    && Number.isFinite(value.score);
}

function isDiscoveredBenchmarkEvidenceRecord(value: unknown): value is DiscoveredBenchmarkEvidenceRecord {
  if (!isRecord(value)) return false;
  return isBenchmarkModelRef(value.modelRef)
    && typeof value.sourceName === 'string'
    && typeof value.sourceUrl === 'string'
    && typeof value.retrievedAt === 'string'
    && Array.isArray(value.metrics)
    && value.metrics.every(isBenchmarkEvidenceMetric);
}

export function isBenchmarkEvidenceDiscoveryState(value: unknown): value is BenchmarkEvidenceDiscoveryState {
  if (!isRecord(value)) return false;
  const status = value.status;
  return (status === 'idle' || status === 'refreshing' || status === 'ready' || status === 'error')
    && (value.retrievedAt === undefined || typeof value.retrievedAt === 'string')
    && Array.isArray(value.records)
    && value.records.every(isDiscoveredBenchmarkEvidenceRecord)
    && Array.isArray(value.errors)
    && value.errors.every((error) => typeof error === 'string');
}
