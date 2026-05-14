import type { AgentCitation, EvidenceChunk } from './types';

type CitationPointer = {
  pageNumber?: number;
  pointerType?: 'figure' | 'table';
  pointerLabel?: string;
  pointerAnchor?: string;
};

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

export function formatCitationPointerLabel(citation: CitationPointer): string | null {
  const pageSegment = typeof citation.pageNumber === 'number' ? `page ${citation.pageNumber}` : null;
  const pointerSegment = citation.pointerType
    ? `${citation.pointerType}${citation.pointerLabel ? ` ${citation.pointerLabel}` : ''}`
    : null;
  if (!pointerSegment && !pageSegment) return null;
  return [pointerSegment, pageSegment].filter(Boolean).join(' · ');
}

export function buildCitationNavigationUrl(citation: Pick<AgentCitation, 'url' | 'pointerAnchor'>): string {
  if (!citation.pointerAnchor) return citation.url;
  const [base] = citation.url.split('#');
  return `${base}#${citation.pointerAnchor}`;
}

export function buildCitationPointerAriaLabel(citation: CitationPointer): string {
  const pageNumber = typeof citation.pageNumber === 'number' ? citation.pageNumber : 'source';
  if (citation.pointerType) {
    const pointerSuffix = citation.pointerLabel ? ` ${citation.pointerLabel}` : '';
    return `Open ${citation.pointerType} citation${pointerSuffix} on page ${pageNumber}`;
  }
  if (typeof citation.pageNumber === 'number') {
    return `Open citation on page ${citation.pageNumber}`;
  }
  return 'Open citation source';
}

function truncateQuote(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 280) return normalized;
  return `${normalized.slice(0, 277).trimEnd()}...`;
}
