import { describe, expect, it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import fixtures from './fixtures.json';

type ModeTrace = {
  caseId: string;
  family: string;
  request: string;
  expectedRoute: string;
  route: string;
  usedFallback: boolean;
  latencyMs: number;
};

type EvalMode = 'legacy' | 'dsr';

function runMode(mode: EvalMode): ModeTrace[] {
  return fixtures.cases.map((testCase) => ({
    caseId: testCase.id,
    family: testCase.family,
    request: testCase.request,
    expectedRoute: testCase.expectedRoute,
    route: testCase[mode].route,
    usedFallback: testCase[mode].usedFallback,
    latencyMs: testCase[mode].latencyMs,
  }));
}

function summarize(traces: ModeTrace[]): { routeHitRate: number; fallbackRate: number } {
  const hitCount = traces.filter((trace) => trace.route === trace.expectedRoute).length;
  const fallbackCount = traces.filter((trace) => trace.usedFallback).length;
  return {
    routeHitRate: hitCount / traces.length,
    fallbackRate: fallbackCount / traces.length,
  };
}

function latencyRegressionRate(legacy: ModeTrace[], dsr: ModeTrace[]): number {
  const legacyByCaseId = new Map(legacy.map((trace) => [trace.caseId, trace]));
  const regressed = dsr.filter((trace) => {
    const legacyTrace = legacyByCaseId.get(trace.caseId);
    return legacyTrace ? trace.latencyMs > legacyTrace.latencyMs : false;
  });
  return regressed.length / dsr.length;
}

function diffRoutes(legacy: ModeTrace[], dsr: ModeTrace[]): Array<{ caseId: string; legacyRoute: string; dsrRoute: string }> {
  const legacyByCaseId = new Map(legacy.map((trace) => [trace.caseId, trace]));
  return dsr
    .map((trace) => ({
      caseId: trace.caseId,
      legacyRoute: legacyByCaseId.get(trace.caseId)?.route ?? 'missing',
      dsrRoute: trace.route,
    }))
    .filter((entry) => entry.legacyRoute !== entry.dsrRoute);
}

describe('route selection + composite execution DSR gate', () => {
  it('runs shared route-selection cases in legacy and DSR modes and writes decision traces for diffing', () => {
    const legacy = runMode('legacy');
    const dsr = runMode('dsr');

    const traceOutputDir = path.join(process.cwd(), 'output', 'eval-traces');
    mkdirSync(traceOutputDir, { recursive: true });
    writeFileSync(path.join(traceOutputDir, 'route-selection-legacy.trace.json'), `${JSON.stringify(legacy, null, 2)}\n`);
    writeFileSync(path.join(traceOutputDir, 'route-selection-dsr.trace.json'), `${JSON.stringify(dsr, null, 2)}\n`);
    writeFileSync(path.join(traceOutputDir, 'route-selection-route-diff.json'), `${JSON.stringify(diffRoutes(legacy, dsr), null, 2)}\n`);

    expect(legacy.length).toBe(fixtures.cases.length);
    expect(dsr.length).toBe(fixtures.cases.length);
  });

  it('enforces route hit-rate, fallback-rate, and latency-regression gates before promoting DSR default', () => {
    const legacy = runMode('legacy');
    const dsr = runMode('dsr');

    const gate = fixtures.gates;
    const dsrSummary = summarize(dsr);
    const dsrLatencyRegressionRate = latencyRegressionRate(legacy, dsr);

    expect(dsrSummary.routeHitRate).toBeGreaterThanOrEqual(gate.minRouteHitRate);
    expect(dsrSummary.fallbackRate).toBeLessThanOrEqual(gate.maxFallbackRate);
    expect(dsrLatencyRegressionRate).toBeLessThanOrEqual(gate.maxLatencyRegressionRate);
  });

  it('only allows DSR default promotion after all target families satisfy gates', () => {
    const dsr = runMode('dsr');
    const gate = fixtures.gates;

    for (const family of fixtures.targetAgentFamilies) {
      const familyTraces = dsr.filter((trace) => trace.family === family);
      const familySummary = summarize(familyTraces);
      expect(familySummary.routeHitRate).toBeGreaterThanOrEqual(gate.minRouteHitRate);
      expect(familySummary.fallbackRate).toBeLessThanOrEqual(gate.maxFallbackRate);
    }
  });
});
