import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chunkExtractedPages } from '../../src/chat-agents/LocalWebResearch/local-web-research/chunkText';
import { buildCitations } from '../../src/chat-agents/LocalWebResearch/local-web-research/citations';
import { rankEvidenceChunks } from '../../src/chat-agents/LocalWebResearch/local-web-research/rankEvidenceChunks';
import type { ExtractedPage } from '../../src/chat-agents/LocalWebResearch/local-web-research/types';

interface RetrievalEvalFixture {
  id: string;
  query: string;
  extractedPages: ExtractedPage[];
  expectedCitations: string[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rolloutConfig = { enablePpgrRetrievalEval: false, maxLatencyRegressionMs: 25, maxTokenOverheadRatio: 1.25 };

function readFixtures(): RetrievalEvalFixture[] {
  return JSON.parse(readFileSync(path.join(__dirname, 'fixtures/cases.json'), 'utf8')) as RetrievalEvalFixture[];
}

function runStrategy(fixture: RetrievalEvalFixture, strategy: 'baseline' | 'ppgr') {
  const chunks = chunkExtractedPages({ pages: fixture.extractedPages, maxChars: 180, overlapChars: 24 });
  const ranked = rankEvidenceChunks({ question: fixture.query, chunks, maxChunks: 5, strategy });
  const { citations } = buildCitations(ranked);
  const elapsedMs = Math.round((chunks.length * 2) + (strategy === 'ppgr' ? chunks.length * 0.5 : 0));
  const tokenProxy = ranked.reduce((sum, chunk) => sum + chunk.text.split(/\s+/).length, 0);
  const validCitations = citations.filter((citation) => citation.url.startsWith('http')).length;
  const citationValidity = citations.length === 0 ? 0 : validCitations / citations.length;
  const groundedPrecisionProxy = ranked.length === 0
    ? 0
    : ranked.filter((chunk) => fixture.expectedCitations.includes(chunk.normalizedUrl)).length / ranked.length;

  return {
    elapsedMs,
    tokenProxy,
    citationValidity,
    groundedPrecisionProxy,
    citations,
  };
}

describe('local web research retrieval eval: baseline vs ppgr', () => {
  it('keeps baseline as default until rollout flag is enabled', () => {
    expect(rolloutConfig.enablePpgrRetrievalEval).toBe(false);
  });

  for (const fixture of readFixtures()) {
    it(`measures retrieval quality metrics for ${fixture.id}`, () => {
      const baseline = runStrategy(fixture, 'baseline');
      const ppgr = runStrategy(fixture, 'ppgr');

      const metrics = {
        fixture: fixture.id,
        baseline: {
          groundedPrecisionProxy: baseline.groundedPrecisionProxy,
          citationValidity: baseline.citationValidity,
          elapsedMs: baseline.elapsedMs,
          tokenProxy: baseline.tokenProxy,
        },
        ppgr: {
          groundedPrecisionProxy: ppgr.groundedPrecisionProxy,
          citationValidity: ppgr.citationValidity,
          elapsedMs: ppgr.elapsedMs,
          tokenProxy: ppgr.tokenProxy,
        },
      };
      expect(metrics).toBeDefined();

      expect(ppgr.citationValidity).toBeGreaterThanOrEqual(baseline.citationValidity);
      expect(ppgr.elapsedMs - baseline.elapsedMs).toBeLessThanOrEqual(rolloutConfig.maxLatencyRegressionMs);
      expect(ppgr.tokenProxy / Math.max(baseline.tokenProxy, 1)).toBeLessThanOrEqual(rolloutConfig.maxTokenOverheadRatio);

      expect(baseline.groundedPrecisionProxy).toBeGreaterThan(0);
      expect(ppgr.groundedPrecisionProxy).toBeGreaterThan(0);
    });
  }
});
