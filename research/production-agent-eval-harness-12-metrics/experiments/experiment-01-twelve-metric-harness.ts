export type MetricName =
  | 'contextPrecision' | 'contextRecall' | 'contextDensity'
  | 'faithfulness' | 'answerRelevance' | 'toneStyleAlignment'
  | 'toolSelectionAccuracy' | 'planningEfficiency' | 'loopDetectionRate'
  | 'p95LatencyMs' | 'costPerSuccessUsd' | 'guardrailViolationRate';

export type PillarName = 'retrieval' | 'generation' | 'agenticBehavior' | 'productionHealth';

export interface CaseTelemetry {
  contextPrecision: number; contextRecall: number; contextDensity: number;
  faithfulness: number; answerRelevance: number; toneStyleAlignment: number;
  toolSelectionAccuracy: number; planningEfficiency: number; loopDetectionRate: number;
  p95LatencyMs: number; costPerSuccessUsd: number; guardrailViolationRate: number;
}

export interface GateConfig {
  minFaithfulness: number;
  minToolSelectionAccuracy: number;
  maxGuardrailViolationRate: number;
  maxP95LatencyMs: number;
}

export interface HarnessReport {
  metricScores: Record<MetricName, number>;
  pillarScores: Record<PillarName, number>;
  overallScore: number;
  releaseReady: boolean;
  blockingReasons: string[];
}

const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const lowerIsBetterToQuality = (value: number, maxAcceptable: number) => clamp01(1 - value / maxAcceptable);

export function evaluateRun(cases: CaseTelemetry[], gates: GateConfig): HarnessReport {
  if (cases.length === 0) throw new Error('evaluateRun requires at least one case.');

  const metricScores: Record<MetricName, number> = {
    contextPrecision: average(cases.map((c) => c.contextPrecision)),
    contextRecall: average(cases.map((c) => c.contextRecall)),
    contextDensity: average(cases.map((c) => c.contextDensity)),
    faithfulness: average(cases.map((c) => c.faithfulness)),
    answerRelevance: average(cases.map((c) => c.answerRelevance)),
    toneStyleAlignment: average(cases.map((c) => c.toneStyleAlignment)),
    toolSelectionAccuracy: average(cases.map((c) => c.toolSelectionAccuracy)),
    planningEfficiency: average(cases.map((c) => c.planningEfficiency)),
    loopDetectionRate: average(cases.map((c) => c.loopDetectionRate)),
    p95LatencyMs: average(cases.map((c) => c.p95LatencyMs)),
    costPerSuccessUsd: average(cases.map((c) => c.costPerSuccessUsd)),
    guardrailViolationRate: average(cases.map((c) => c.guardrailViolationRate)),
  };

  const retrieval = average([metricScores.contextPrecision, metricScores.contextRecall, metricScores.contextDensity]);
  const generation = average([metricScores.faithfulness, metricScores.answerRelevance, metricScores.toneStyleAlignment]);
  const agenticBehavior = average([
    metricScores.toolSelectionAccuracy,
    metricScores.planningEfficiency,
    lowerIsBetterToQuality(metricScores.loopDetectionRate, 0.2),
  ]);
  const productionHealth = average([
    lowerIsBetterToQuality(metricScores.p95LatencyMs, gates.maxP95LatencyMs),
    lowerIsBetterToQuality(metricScores.costPerSuccessUsd, 2.0),
    lowerIsBetterToQuality(metricScores.guardrailViolationRate, gates.maxGuardrailViolationRate),
  ]);

  const pillarScores: Record<PillarName, number> = { retrieval, generation, agenticBehavior, productionHealth };
  const overallScore = average(Object.values(pillarScores));

  const blockingReasons: string[] = [];
  if (metricScores.faithfulness < gates.minFaithfulness) blockingReasons.push('Faithfulness below threshold.');
  if (metricScores.toolSelectionAccuracy < gates.minToolSelectionAccuracy) blockingReasons.push('Tool selection accuracy below threshold.');
  if (metricScores.guardrailViolationRate > gates.maxGuardrailViolationRate) blockingReasons.push('Guardrail violation rate above threshold.');
  if (metricScores.p95LatencyMs > gates.maxP95LatencyMs) blockingReasons.push('P95 latency above threshold.');

  return { metricScores, pillarScores, overallScore, releaseReady: blockingReasons.length === 0, blockingReasons };
}
