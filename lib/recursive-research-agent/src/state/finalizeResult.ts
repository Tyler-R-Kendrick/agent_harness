import type { RecursiveResearchResult, ResearchState, SufficiencyScore, SynthesizerTool } from '../types';
import { domainFromUrl } from '../utils/domain';
import { scoreSufficiency } from '../decisions/scoreSufficiency';

export async function finalizeResult(args: {
  state: ResearchState;
  synthesizer?: SynthesizerTool;
  synthesize?: boolean;
  model?: string;
  signal?: AbortSignal;
}): Promise<RecursiveResearchResult> {
  const { state } = args;
  let finalAnswer: string | undefined;
  if (args.synthesize && args.synthesizer) {
    try {
      finalAnswer = await args.synthesizer.synthesize({
        question: state.task.question,
        evidence: state.evidence,
        citations: state.citations,
        claims: state.claims,
        gaps: state.gaps,
        model: args.model,
        signal: args.signal,
      });
    } catch (error) {
      state.errors.push({ stage: 'synthesis', message: error instanceof Error ? error.message : String(error), recoverable: true });
    }
  }
  const sufficiency = scoreSufficiency(state);
  return {
    id: state.id,
    task: state.task,
    ...(finalAnswer ? { finalAnswer } : {}),
    evidence: state.evidence,
    citations: state.citations,
    claims: state.claims,
    gaps: state.gaps,
    visited: state.visited,
    frontierRemaining: state.frontier.list(),
    decisions: state.decisions,
    graph: state.graph.toJSON(),
    errors: state.errors,
    metrics: metrics(state, sufficiency),
    elapsedMs: Date.now() - state.startedAt,
    createdAt: new Date(state.startedAt).toISOString(),
    metadata: state.metadata,
  };
}

function metrics(state: ResearchState, sufficiency: SufficiencyScore): RecursiveResearchResult['metrics'] {
  return {
    iterations: state.counters.iterations,
    searchQueriesExecuted: state.counters.searchQueriesExecuted,
    urlsFetched: state.counters.urlsFetched,
    uniqueDomainsVisited: new Set(state.visited.map((item) => item.url ? domainFromUrl(item.url) : undefined).filter(Boolean)).size,
    evidenceItems: state.evidence.length,
    sufficiency,
  };
}
