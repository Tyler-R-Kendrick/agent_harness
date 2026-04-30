import type { AgentCitation, EvidenceChunk } from './types';

export function buildCitations(evidence: EvidenceChunk[]): {
  evidence: EvidenceChunk[];
  citations: AgentCitation[];
} {
  const citationIds = new Map<string, number>();
  const citations: AgentCitation[] = [];
  const citedEvidence = evidence.map((chunk) => {
    let citationId = citationIds.get(chunk.normalizedUrl);
    if (!citationId) {
      citationId = citationIds.size + 1;
      citationIds.set(chunk.normalizedUrl, citationId);
      citations.push({
        id: citationId,
        ...(chunk.title ? { title: chunk.title } : {}),
        url: chunk.url,
        normalizedUrl: chunk.normalizedUrl,
        quote: truncateQuote(chunk.text),
      });
    }
    return { ...chunk, citationId };
  });
  return { evidence: citedEvidence, citations };
}

function truncateQuote(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 280) return normalized;
  return `${normalized.slice(0, 277).trimEnd()}...`;
}
