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
  benchmarkEvidenceSource: string;
  safeguardsTriggered: string[];
  estimatedCostDelta: CostTierDelta;
  estimatedLatencyDelta: LatencyTierDelta;
  routingDecision: RuntimeRoutingDecision;
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

export function buildRoutingDecisionRecord(input: {
  requestId: string;
  requestText: string;
  selectedProvider: ModelBackedAgentProvider;
  selectedModel?: string;
  routingDecision: RuntimeRoutingDecision;
  benchmarkEvidenceSource?: string;
}): RoutingDecisionRecord {
  const complexityScore = Math.min(1, Number((input.requestText.length / 500).toFixed(2)));
  const complexityTier: ComplexityTier = complexityScore >= 0.75 ? 'high' : complexityScore >= 0.35 ? 'medium' : 'low';
  const safeguardsTriggered: string[] = [];
  if (input.routingDecision.reasonCode === 'low-confidence-premium-escalation') safeguardsTriggered.push('low-confidence-premium-escalation');
  if (classifyTaskClass(input.requestText) === 'security') safeguardsTriggered.push('security-sensitive');

  return {
    requestId: input.requestId,
    timestamp: Date.now(),
    selectedProvider: input.selectedProvider,
    selectedModel: input.selectedModel ?? 'default',
    taskClass: classifyTaskClass(input.requestText),
    complexityScore,
    complexityTier,
    complexityConfidence: input.routingDecision.confidence,
    benchmarkEvidenceSource: input.benchmarkEvidenceSource ?? 'runtime-router',
    safeguardsTriggered,
    estimatedCostDelta: input.routingDecision.tier === 'premium' ? 'up' : 'flat',
    estimatedLatencyDelta: input.routingDecision.tier === 'premium' ? 'up' : 'flat',
    routingDecision: input.routingDecision,
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
      },
      benchmark_evidence_source: record.benchmarkEvidenceSource,
      safeguards_triggered: record.safeguardsTriggered,
      estimated_deltas: {
        cost_tier: record.estimatedCostDelta,
        latency_tier: record.estimatedLatencyDelta,
      },
      routing_decision: record.routingDecision,
    }))
    .join('\n');
}
