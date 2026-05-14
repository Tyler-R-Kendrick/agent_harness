import type { AgentCitation, EvidenceChunk } from './types';

type CitationPointer = {
  kind?: 'text' | 'pointer';
  docId?: string;
  page?: number;
  bbox?: { x: number; y: number; width: number; height: number };
  assetUri?: string;
  assetAnchor?: string;
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
    const citationKey = buildCitationKey(chunk);
    let citationId = citationIds.get(citationKey);
    if (!citationId) {
      citationId = citationIds.size + 1;
      citationIds.set(citationKey, citationId);
      citations.push({
        id: citationId,
        kind: chunk.pointerType || chunk.pointerAnchor || chunk.pageNumber ? 'pointer' : 'text',
        ...(chunk.title ? { title: chunk.title } : {}),
        url: chunk.url,
        normalizedUrl: chunk.normalizedUrl,
        quote: truncateQuote(chunk.text),
        ...(typeof chunk.pageNumber === 'number' ? { page: chunk.pageNumber } : {}),
        ...(typeof chunk.pageNumber === 'number' ? { pageNumber: chunk.pageNumber } : {}),
        ...(chunk.pointerType ? { pointerType: chunk.pointerType } : {}),
        ...(chunk.pointerLabel ? { pointerLabel: chunk.pointerLabel } : {}),
        ...(chunk.pointerAnchor ? { pointerAnchor: chunk.pointerAnchor } : {}),
      });
    }
    return { ...chunk, citationId };
  });
  return { evidence: citedEvidence, citations };
}

function buildCitationKey(chunk: EvidenceChunk): string {
  const pointerBundleKey = [chunk.pageNumber ?? '', chunk.pointerType ?? '', chunk.pointerLabel ?? '', chunk.pointerAnchor ?? ''].join('|');
  return `${chunk.normalizedUrl}::${pointerBundleKey}`;
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

export function buildCitationAssetNavigationTarget(citation: CitationPointer): string | null {
  if (!citation.assetUri) return null;
  if (citation.assetAnchor) return `${citation.assetUri}#${citation.assetAnchor}`;
  return citation.assetUri;
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
