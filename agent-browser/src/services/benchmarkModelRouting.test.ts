import { describe, expect, it, vi } from 'vitest';
import {
  areStagedRoutingChecksPassing,
  DEFAULT_BENCHMARK_ROUTING_SETTINGS,
  buildBenchmarkRoutingCandidates,
  createDefaultRoutingStrategy,
  discoverBenchmarkEvidence,
  inferBenchmarkTaskClass,
  isBenchmarkRoutingSettings,
  mergeDiscoveredBenchmarkEvidence,
  recommendHybridRoute,
  recommendBenchmarkRoute,
} from './benchmarkModelRouting';

describe('benchmark model routing', () => {
  const candidates = buildBenchmarkRoutingCandidates({
    copilotModels: [
      { id: 'gpt-4.1', name: 'GPT-4.1', reasoning: true, vision: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', reasoning: false, vision: true },
    ],
    installedModels: [
      {
        id: 'onnx-community/Qwen3-0.6B-ONNX',
        name: 'Qwen3 local',
        author: 'onnx-community',
        task: 'text-generation',
        downloads: 1,
        likes: 1,
        tags: [],
        sizeMB: 512,
        status: 'installed',
      },
    ],
  });

  it('builds route candidates from available GHCP and installed Codi models', () => {
    expect(candidates.map((candidate) => candidate.ref)).toEqual([
      'ghcp:gpt-4.1',
      'ghcp:gpt-4o-mini',
      'codi:onnx-community/Qwen3-0.6B-ONNX',
    ]);
  });

  it('honors a valid per-task pin before auto scoring', () => {
    const route = recommendBenchmarkRoute({
      taskClass: 'verification',
      candidates,
      settings: {
        ...DEFAULT_BENCHMARK_ROUTING_SETTINGS,
        pins: { verification: 'codi:onnx-community/Qwen3-0.6B-ONNX' },
      },
    });

    expect(route?.candidate.ref).toBe('codi:onnx-community/Qwen3-0.6B-ONNX');
    expect(route?.reason).toContain('Pinned');
  });

  it('uses the cost objective to prefer cheaper sufficient models', () => {
    const route = recommendBenchmarkRoute({
      taskClass: 'browser-action',
      candidates,
      settings: { ...DEFAULT_BENCHMARK_ROUTING_SETTINGS, objective: 'cost' },
    });

    expect(route?.candidate.ref).toBe('ghcp:gpt-4o-mini');
  });

  it('uses the quality objective to prefer the strongest model', () => {
    const route = recommendBenchmarkRoute({
      taskClass: 'planning',
      candidates,
      settings: { ...DEFAULT_BENCHMARK_ROUTING_SETTINGS, objective: 'quality' },
    });

    expect(route?.candidate.ref).toBe('ghcp:gpt-4.1');
  });


  it('registers the default deterministic+benchmark hybrid routing strategy', () => {
    const strategy = createDefaultRoutingStrategy();
    const taskClass = strategy.classify({
      provider: 'codi',
      latestUserInput: 'run tests and verify this patch',
      toolsEnabled: true,
      taskClass: 'planning',
    });
    const recommendation = strategy.recommend(candidates, {
      ...DEFAULT_BENCHMARK_ROUTING_SETTINGS,
      objective: 'quality',
    });
    const finalized = strategy.finalize(recommendation, {
      forceEscalation: true,
      forceConfidenceFallback: true,
    });

    expect(taskClass).toBe('verification');
    expect(recommendation?.taskClass).toBe('verification');
    expect(finalized?.reason).toContain('Core safeguards enforced');
  });
  it('infers task classes from provider and request text', () => {
    expect(inferBenchmarkTaskClass({ provider: 'planner', latestUserInput: 'break this down', toolsEnabled: false })).toBe('planning');
    expect(inferBenchmarkTaskClass({ provider: 'researcher', latestUserInput: 'find sources', toolsEnabled: false })).toBe('research');
    expect(inferBenchmarkTaskClass({ provider: 'codi', latestUserInput: 'run tests and verify the PR', toolsEnabled: true })).toBe('verification');
    expect(inferBenchmarkTaskClass({ provider: 'debugger', latestUserInput: 'inspect this crash', toolsEnabled: true })).toBe('review');
    expect(inferBenchmarkTaskClass({ provider: 'codi', latestUserInput: 'click through the form', toolsEnabled: true })).toBe('browser-action');
  });

  it('validates persisted routing settings', () => {
    expect(isBenchmarkRoutingSettings(DEFAULT_BENCHMARK_ROUTING_SETTINGS)).toBe(true);
    expect(isBenchmarkRoutingSettings({ enabled: true, objective: 'fast', pins: {} })).toBe(false);
    expect(isBenchmarkRoutingSettings({ enabled: true, routerMode: 'shadow', minConfidence: 0.5, complexityThreshold: 0.6, escalationKeywords: [], sessionPinning: true, objective: 'fast', pins: {} })).toBe(false);
    expect(isBenchmarkRoutingSettings({ enabled: true, objective: 'cost', pins: { planning: 1 } })).toBe(false);
    expect(isBenchmarkRoutingSettings({
      ...DEFAULT_BENCHMARK_ROUTING_SETTINGS,
      complexityRouting: {
        enabled: true,
        mode: 'active',
        trafficSplitPercent: 42,
        pinning: { workspaceAfterHardTask: true, sessionAfterHardTask: false },
      },
    })).toBe(true);
    expect(isBenchmarkRoutingSettings({
      enabled: true,
      objective: 'cost',
      pins: {},
      complexityRouting: { enabled: true, mode: 'active', trafficSplitPercent: 120 },
    })).toBe(false);
  });

  it('requires staged rollout eval cases before enforce mode can activate', () => {
    expect(areStagedRoutingChecksPassing([
      { id: 'misroute-prevention-complex', prompt: 'complex', expectedModelClass: 'premium' },
      { id: 'misroute-prevention-escalation', prompt: 'security', expectedModelClass: 'premium' },
      { id: 'cost-win-simple', prompt: 'summarize', expectedModelClass: 'cheap' },
      { id: 'policy-invariants', prompt: 'rules', expectedModelClass: 'cheap' },
    ])).toBe(true);
    expect(areStagedRoutingChecksPassing([
      { id: 'misroute-prevention-complex', prompt: 'complex', expectedModelClass: 'premium' },
    ])).toBe(false);
  });

  it('discovers Hugging Face model-card benchmark results and reranks installed local models', async () => {
    const fetchJson = vi.fn(async (url: string) => {
      expect(url).toBe('https://huggingface.co/api/models/onnx-community%2FQwen3-0.6B-ONNX');
      return {
        cardData: {
          'model-index': [
            {
              name: 'Qwen3 local',
              results: [
                {
                  task: { type: 'text-generation' },
                  dataset: { name: 'SWE-bench Verified' },
                  metrics: [{ type: 'resolve_rate', value: 93.4 }],
                },
                {
                  task: { type: 'text-generation' },
                  dataset: { name: 'WebArena' },
                  metrics: [{ type: 'success_rate', value: 88.2 }],
                },
              ],
            },
          ],
        },
      };
    });

    const discovery = await discoverBenchmarkEvidence({
      candidates,
      fetchJson,
      now: new Date('2026-05-03T12:00:00.000Z'),
    });
    const refreshedCandidates = mergeDiscoveredBenchmarkEvidence(candidates, discovery.records);
    const route = recommendBenchmarkRoute({
      taskClass: 'verification',
      candidates: refreshedCandidates,
      settings: { ...DEFAULT_BENCHMARK_ROUTING_SETTINGS, objective: 'quality' },
    });

    expect(discovery.status).toBe('ready');
    expect(discovery.records).toHaveLength(1);
    expect(discovery.records[0]).toMatchObject({
      modelRef: 'codi:onnx-community/Qwen3-0.6B-ONNX',
      sourceName: 'Hugging Face model card',
      retrievedAt: '2026-05-03T12:00:00.000Z',
    });
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(route?.candidate.ref).toBe('codi:onnx-community/Qwen3-0.6B-ONNX');
    expect(route?.reason).toContain('SWE-bench Verified');
  });

  it('discovers trusted benchmark-index records for remote provider models', async () => {
    const fetchJson = vi.fn(async (url: string) => {
      expect(url).toBe('https://www.swebench.com/agent-browser-benchmarks.json');
      return {
        records: [
          {
            provider: 'ghcp',
            modelId: 'gpt-4o-mini',
            sourceName: 'SWE-bench Verified',
            sourceUrl: 'https://www.swebench.com/',
            retrievedAt: '2026-05-02T00:00:00.000Z',
            metrics: [
              { taskClass: 'verification', benchmark: 'SWE-bench Verified', score: 95.1 },
              { taskClass: 'review', benchmark: 'SWE-bench Verified', score: 91.6 },
            ],
          },
        ],
      };
    });

    const discovery = await discoverBenchmarkEvidence({
      candidates,
      benchmarkIndexUrls: ['https://www.swebench.com/agent-browser-benchmarks.json'],
      fetchJson,
      now: new Date('2026-05-03T12:00:00.000Z'),
    });
    const refreshedCandidates = mergeDiscoveredBenchmarkEvidence(candidates, discovery.records);
    const route = recommendBenchmarkRoute({
      taskClass: 'verification',
      candidates: refreshedCandidates,
      settings: { ...DEFAULT_BENCHMARK_ROUTING_SETTINGS, objective: 'quality' },
    });

    expect(discovery.records.map((record) => record.modelRef)).toContain('ghcp:gpt-4o-mini');
    expect(route?.candidate.ref).toBe('ghcp:gpt-4o-mini');
    expect(route?.candidate.evidenceSource).toBe('SWE-bench Verified');
  });

  it('ignores benchmark-index records from untrusted source URLs', async () => {
    const discovery = await discoverBenchmarkEvidence({
      candidates,
      benchmarkIndexUrls: ['https://www.swebench.com/agent-browser-benchmarks.json'],
      fetchJson: async () => ({
        records: [
          {
            provider: 'ghcp',
            modelId: 'gpt-4.1',
            sourceName: 'Unknown leaderboard',
            sourceUrl: 'https://benchmarks.example.invalid/results',
            metrics: [{ taskClass: 'planning', benchmark: 'Synthetic', score: 100 }],
          },
        ],
      }),
      now: new Date('2026-05-03T12:00:00.000Z'),
    });

    expect(discovery.records).toEqual([]);
    expect(discovery.errors).toEqual(['Ignored untrusted benchmark source https://benchmarks.example.invalid/results for ghcp:gpt-4.1.']);
  });

  it('overrides cost objective with premium-safe candidate when escalation is detected', () => {
    const route = recommendHybridRoute({
      prompt: 'Need security review and incident response runbook updates',
      provider: 'codi',
      toolsEnabled: true,
      candidates,
      settings: {
        ...DEFAULT_BENCHMARK_ROUTING_SETTINGS,
        objective: 'cost',
        minConfidence: 0.2,
      },
    });

    expect(route?.benchmark.candidate.ref).toBe('codi:onnx-community/Qwen3-0.6B-ONNX');
    expect(route?.candidate.ref).toBe('ghcp:gpt-4.1');
    expect(route?.complexity.reasons).toContain('escalation:security');
    expect(route?.mergedReason).toContain('policy override');
  });

  it('keeps objective-weighted candidate when no premium override conditions trigger', () => {
    const route = recommendHybridRoute({
      prompt: 'Summarize this changelog',
      provider: 'planner',
      toolsEnabled: false,
      candidates,
      settings: {
        ...DEFAULT_BENCHMARK_ROUTING_SETTINGS,
        objective: 'cost',
      },
    });

    expect(route?.benchmark.candidate.ref).toBe('codi:onnx-community/Qwen3-0.6B-ONNX');
    expect(route?.candidate.ref).toBe('codi:onnx-community/Qwen3-0.6B-ONNX');
    expect(route?.mergedReason).toContain('Objective-weighted route selected');
  });
});
