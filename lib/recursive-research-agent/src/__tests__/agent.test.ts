import { describe, expect, it, vi } from 'vitest';
import { RecursiveResearchAgent } from '../agent';
import type { WebResearchTool } from '../types';

function webTool(resultsByCall: Array<{ text: string; url: string; title?: string }>, failFirst = false): WebResearchTool {
  let calls = 0;
  return {
    run: vi.fn(async ({ question }) => {
      calls += 1;
      if (failFirst && calls === 1) throw new Error('temporary search failure');
      const item = resultsByCall[Math.min(calls - 1, resultsByCall.length - 1)];
      return {
        searchResults: [{ title: item.title ?? `Result ${calls}`, url: item.url, snippet: item.text, rank: 1 }],
        evidence: [{ id: `ev-${calls}`, url: item.url, normalizedUrl: item.url, title: item.title, text: `${question}. ${item.text}`, score: 0.85, citationId: calls }],
        citations: [{ id: calls, title: item.title, url: item.url, quote: item.text }],
      };
    }),
  };
}

describe('RecursiveResearchAgent', () => {
  it('executes multiple bounded iterations, records decisions, graph, evidence, citations, and events', async () => {
    const events: string[] = [];
    const tool = webTool([
      { url: 'https://meta.example.com', title: 'Metasearch', text: 'metasearch options for agents' },
      { url: 'https://index.example.com', title: 'Indexing', text: 'local indexing options and limitations citations page extraction' },
    ]);
    const agent = new RecursiveResearchAgent({
      tools: { webResearchAgent: tool },
      defaults: { maxIterations: 3, targetSufficiencyScore: 0.7, maxTargetsPerIteration: 1 },
      onEvent: (event) => events.push(event.type),
    });

    const result = await agent.run({
      question: 'Compare free self-hosted search approaches for AI agents',
      objective: 'compare_options',
      successCriteria: ['metasearch', 'local indexing', 'limitations', 'citations'],
      budget: { maxIterations: 3, maxDepth: 2 },
    });

    expect(tool.run).toHaveBeenCalledTimes(result.metrics.iterations);
    expect(tool.run).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ recursiveRunId: result.id, depth: expect.any(Number) }),
      synthesize: false,
    }));
    expect(result.metrics.iterations).toBeGreaterThanOrEqual(2);
    expect(result.evidence.length).toBeGreaterThanOrEqual(2);
    expect(result.citations.length).toBeGreaterThanOrEqual(2);
    expect(result.decisions.length).toBeGreaterThan(0);
    expect(result.graph.nodes.some((node) => node.type === 'evidence')).toBe(true);
    expect(result.metrics.iterations).toBeLessThanOrEqual(3);
    expect(events).toEqual(expect.arrayContaining(['started', 'frontier_seeded', 'iteration_started', 'target_completed', 'decision', 'completed']));
  });

  it('stops when sufficiency threshold is reached and respects max iteration budget', async () => {
    const enoughTool = webTool([
      { url: 'https://a.example.com', text: 'metasearch local indexing page extraction limitations citations' },
    ]);
    const agent = new RecursiveResearchAgent({
      tools: { webResearchAgent: enoughTool },
      defaults: { maxIterations: 1, targetSufficiencyScore: 0.2 },
    });

    const result = await agent.run({ question: 'metasearch local indexing', budget: { maxIterations: 1 } });

    expect(result.metrics.iterations).toBe(1);
    expect(result.decisions.at(-1)?.action).toBe('stop');
  });

  it('continues after recoverable target failure and returns synthesis only when requested', async () => {
    const tool = webTool([
      { url: 'https://after-failure.example.com', text: 'metasearch local indexing citations' },
      { url: 'https://after-failure.example.com/two', text: 'limitations extraction' },
    ], true);
    const synthesizer = { synthesize: vi.fn(async () => 'Synthesized from evidence [1].') };
    const agent = new RecursiveResearchAgent({
      tools: { webResearchAgent: tool, synthesizer },
      defaults: { maxIterations: 2, maxTargetsPerIteration: 1, targetSufficiencyScore: 0.4 },
    });

    const result = await agent.run({
      question: 'free self hosted search',
      initialQueries: ['will fail', 'will recover'],
      synthesize: true,
    });

    expect(result.errors.some((error) => error.stage === 'executing_target' && error.recoverable)).toBe(true);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(synthesizer.synthesize).toHaveBeenCalled();
    expect(result.finalAnswer).toContain('[1]');
  });

  it('returns evidence and citations when synthesis fails', async () => {
    const tool = webTool([{ url: 'https://source.example.com', text: 'citations evidence' }]);
    const agent = new RecursiveResearchAgent({
      tools: { webResearchAgent: tool, synthesizer: { synthesize: vi.fn(async () => { throw new Error('model unavailable'); }) } },
      defaults: { maxIterations: 1, targetSufficiencyScore: 0.1 },
    });

    const result = await agent.run({ question: 'collect sources', synthesize: true });

    expect(result.finalAnswer).toBeUndefined();
    expect(result.evidence).toHaveLength(1);
    expect(result.errors.some((error) => error.stage === 'synthesis')).toBe(true);
  });
});
