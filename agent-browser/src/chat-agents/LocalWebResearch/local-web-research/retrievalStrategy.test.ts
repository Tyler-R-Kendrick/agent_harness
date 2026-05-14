import { describe, expect, it } from 'vitest';
import { resolveRetrievalStrategy, TextChunkRetrievalStrategy } from './retrievalStrategy';
import type { ExtractedPage, RetrievalStrategy } from './types';

const page: ExtractedPage = {
  id: 'p-1',
  url: 'https://example.com/story',
  normalizedUrl: 'https://example.com/story',
  title: 'Example story',
  text: 'Alpha beta gamma delta. Alpha appears often in this text.',
  length: 58,
  fetchedAt: new Date(0).toISOString(),
};

describe('TextChunkRetrievalStrategy', () => {
  it('retrieves ranked evidence with citations', () => {
    const strategy = new TextChunkRetrievalStrategy();
    const result = strategy.retrieve({
      question: 'What does alpha describe?',
      extractedPages: [page],
      maxEvidenceChunks: 2,
      mode: 'text',
    });

    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.evidence[0].citationId).toBe(1);
  });

  it('uses ppgr mode without changing the strategy boundary', () => {
    const strategy = new TextChunkRetrievalStrategy();
    const result = strategy.retrieve({
      question: 'alpha beta',
      extractedPages: [page],
      maxEvidenceChunks: 1,
      mode: 'ppgr',
    });

    expect(result.evidence).toHaveLength(1);
  });
});

describe('resolveRetrievalStrategy', () => {
  it('returns the provided custom retrieval strategy object', () => {
    const custom: RetrievalStrategy = {
      retrieve: () => ({ evidence: [], citations: [], pointers: { kind: 'custom' } }),
    };

    expect(resolveRetrievalStrategy(custom)).toBe(custom);
  });

  it('returns text chunk strategy for mode identifiers or undefined', () => {
    expect(resolveRetrievalStrategy()).toBeInstanceOf(TextChunkRetrievalStrategy);
    expect(resolveRetrievalStrategy('text')).toBeInstanceOf(TextChunkRetrievalStrategy);
    expect(resolveRetrievalStrategy('ppgr')).toBeInstanceOf(TextChunkRetrievalStrategy);
  });
});
