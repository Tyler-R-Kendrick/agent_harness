import { stableHash } from './hash';
import type { EvidenceChunk, ExtractedPage } from './types';

export function chunkExtractedPages(args: {
  pages: ExtractedPage[];
  maxChars?: number;
  overlapChars?: number;
}): EvidenceChunk[] {
  const maxChars = Math.max(100, args.maxChars ?? 1200);
  const overlapChars = Math.max(0, Math.min(args.overlapChars ?? 150, Math.floor(maxChars / 2)));
  const chunks: EvidenceChunk[] = [];

  for (const page of args.pages) {
    const windows = chunkText(page.text, maxChars, overlapChars);
    windows.forEach((text, index) => {
      chunks.push({
        id: `chunk-${stableHash(page.normalizedUrl)}-${index + 1}-${stableHash(text)}`,
        url: page.finalUrl ?? page.url,
        normalizedUrl: page.normalizedUrl,
        ...(page.title ? { title: page.title } : {}),
        text,
        score: 0,
        ...(page.sourceResultId ? { sourceResultId: page.sourceResultId } : {}),
        pageId: page.id,
      });
    });
  }

  return chunks;
}

function chunkText(text: string, maxChars: number, overlapChars: number): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    if (!current.trim()) return;
    chunks.push(current.trim());
    current = overlapChars > 0 ? current.slice(-overlapChars).trimStart() : '';
  };

  for (const paragraph of paragraphs.length ? paragraphs : [text]) {
    if (paragraph.length > maxChars) {
      flush();
      for (let start = 0; start < paragraph.length; start += maxChars - overlapChars) {
        chunks.push(paragraph.slice(start, start + maxChars).trim());
      }
      current = '';
      continue;
    }
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > maxChars) {
      flush();
      current = paragraph;
    } else {
      current = next;
    }
  }
  flush();
  return chunks.filter(Boolean);
}
