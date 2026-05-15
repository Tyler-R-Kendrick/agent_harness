import type { ModelBackedAgentProvider } from '../chat-agents/types';
import type { RuntimeRoutingDecision } from '../chat-agents';

export type RoutingTaskClass = 'simple' | 'general' | 'complex' | 'security';
export type ComplexityTier = 'low' | 'medium' | 'high';
export type LatencyTierDelta = 'down' | 'flat' | 'up';
export type CostTierDelta = 'down' | 'flat' | 'up';

export interface RoutingDecisionRecord {
  requestId: string;
  timestamp: number;
  selectedProvider: ModelBackedAgentProvider;
  selectedModel: string;
  taskClass: RoutingTaskClass;
  complexityScore: number;
  complexityTier: ComplexityTier;
  complexityConfidence: number;
  complexityReasons: string[];
  candidateSetSummary: string;
  benchmarkEvidenceSource: string;
  safeguardsTriggered: string[];
  estimatedCostDelta: CostTierDelta;
  estimatedLatencyDelta: LatencyTierDelta;
  fallbackCause: string | null;
  routingMode: 'active' | 'shadow';
  routingDecision: RuntimeRoutingDecision;
  skillRouteTrace?: {
    selectedSkill: string;
    topAlternatives: Array<{ skill: string; score: number; reasonCode: string }>;
    reasonCodes: string[];
  };
}

const STORAGE_KEY = 'agent-browser.routing-observability';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function classifyTaskClass(requestText: string): RoutingTaskClass {
  if (/security|auth|credential|secret|permission/i.test(requestText)) return 'security';
  if (requestText.length < 120) return 'simple';
  if (requestText.length > 420) return 'complex';
  return 'general';
}

function inferComplexityReasons(requestText: string, taskClass: RoutingTaskClass): string[] {
  const reasons: string[] = [];
  if (requestText.length >= 420) reasons.push('long-request');
  if (/\b(test|tests|verify|verification|lint|build|coverage|eval|audit)\b/i.test(requestText)) reasons.push('verification-oriented');
  if (/\b(review|diff|pr|pull request|critique|inspect|debug|regression)\b/i.test(requestText)) reasons.push('review-oriented');
  if (/\b(research|source|sources|compare|investigate|find)\b/i.test(requestText)) reasons.push('research-oriented');
  if (taskClass === 'security') reasons.push('security-sensitive');
  return reasons.length > 0 ? reasons : ['general-request'];
}
export function buildRoutingDecisionRecord(input: {
  requestId: string;
  requestText: string;
  selectedProvider: ModelBackedAgentProvider;
  selectedModel?: string;
  routingDecision: RuntimeRoutingDecision;
  benchmarkEvidenceSource?: string;
  candidateSetSummary?: string;
  fallbackCause?: string | null;
  routingMode?: 'active' | 'shadow';
  skillRouteTrace?: RoutingDecisionRecord['skillRouteTrace'];
}): RoutingDecisionRecord {
  const complexityScore = Math.min(1, Number((input.requestText.length / 500).toFixed(2)));
  const taskClass = classifyTaskClass(input.requestText);
  const complexityReasons = inferComplexityReasons(input.requestText, taskClass);
  const complexityTier: ComplexityTier = complexityScore >= 0.75 ? 'high' : complexityScore >= 0.35 ? 'medium' : 'low';
  const safeguardsTriggered: string[] = [];
  if (input.routingDecision.reasonCode === 'low-confidence-premium-escalation') safeguardsTriggered.push('low-confidence-premium-escalation');
  if (taskClass === 'security') safeguardsTriggered.push('security-sensitive');

  return {
    requestId: input.requestId,
    timestamp: Date.now(),
    selectedProvider: input.selectedProvider,
    selectedModel: input.selectedModel ?? 'default',
    taskClass,
    complexityScore,
    complexityTier,
    complexityConfidence: input.routingDecision.confidence,
    complexityReasons,
    candidateSetSummary: input.candidateSetSummary ?? 'candidate-set-unavailable',
    benchmarkEvidenceSource: input.benchmarkEvidenceSource ?? 'runtime-router',
    safeguardsTriggered,
    estimatedCostDelta: input.routingDecision.tier === 'premium' ? 'up' : 'flat',
    estimatedLatencyDelta: input.routingDecision.tier === 'premium' ? 'up' : 'flat',
    fallbackCause: input.fallbackCause ?? null,
    routingMode: input.routingMode ?? 'active',
    routingDecision: input.routingDecision,
    ...(input.skillRouteTrace ? { skillRouteTrace: input.skillRouteTrace } : {}),
  };
}

export function persistRoutingDecisionRecord(record: RoutingDecisionRecord): void {
  const storage = getStorage();
  if (!storage) return;
  const current = loadRoutingDecisionRecords();
  storage.setItem(STORAGE_KEY, JSON.stringify([...current, record].slice(-200)));
}

export function loadRoutingDecisionRecords(): RoutingDecisionRecord[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as RoutingDecisionRecord[] : [];
  } catch {
    return [];
  }
}

export function exportRoutingDecisionRecordsForEval(records: RoutingDecisionRecord[]): string {
  return records
    .map((record) => JSON.stringify({
      eval_type: 'routing-regression-record',
      request_id: record.requestId,
      timestamp: record.timestamp,
      selected_provider: record.selectedProvider,
      selected_model: record.selectedModel,
      task_class: record.taskClass,
      complexity: {
        score: record.complexityScore,
        tier: record.complexityTier,
        confidence: record.complexityConfidence,
        reasons: record.complexityReasons,
      },
      candidate_set_summary: record.candidateSetSummary,
      benchmark_evidence_source: record.benchmarkEvidenceSource,
      safeguards_triggered: record.safeguardsTriggered,
      fallback_cause: record.fallbackCause,
      routing_mode: record.routingMode,
      estimated_deltas: {
        cost_tier: record.estimatedCostDelta,
        latency_tier: record.estimatedLatencyDelta,
      },
      routing_decision: record.routingDecision,
      skill_route_trace: record.skillRouteTrace,
    }))
    .join('\n');
}
