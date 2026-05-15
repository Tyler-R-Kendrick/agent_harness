import { buildCitations } from './citations';
import { chunkExtractedPages } from './chunkText';
import { rankEvidenceChunks } from './rankEvidenceChunks';
import type { AgentCitation, EvidenceChunk, ExtractedPage, RetrievalStrategyMode } from './types';

export type RetrievalStrategyInput = {
  question: string;
  extractedPages: ExtractedPage[];
  maxEvidenceChunks: number;
  metadata?: Record<string, unknown>;
  mode?: RetrievalStrategyMode;
};

export type RetrievalStrategyResult = {
  evidence: EvidenceChunk[];
  citations: AgentCitation[];
  pointers?: Record<string, unknown>;
};

export interface RetrievalStrategy {
  retrieve(input: RetrievalStrategyInput): RetrievalStrategyResult;
}

export class TextChunkRetrievalStrategy implements RetrievalStrategy {
  retrieve(input: RetrievalStrategyInput): RetrievalStrategyResult {
    const rankingStrategy = input.mode === 'ppgr' ? 'ppgr' : 'baseline';
    const ranked = rankEvidenceChunks({
      question: input.question,
      chunks: chunkExtractedPages({ pages: input.extractedPages }),
      maxChunks: input.maxEvidenceChunks,
      strategy: rankingStrategy,
    });
    return buildCitations(ranked);
  }
}

export function resolveRetrievalStrategy(strategy?: RetrievalStrategy | RetrievalStrategyMode): RetrievalStrategy {
  if (strategy && typeof strategy === 'object' && 'retrieve' in strategy) {
    return strategy;
  }
  return new TextChunkRetrievalStrategy();
}
