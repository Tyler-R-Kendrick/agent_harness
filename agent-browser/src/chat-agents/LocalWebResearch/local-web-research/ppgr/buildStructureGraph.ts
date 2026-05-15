import { stableHash } from '../hash';
import type { ExtractedPage } from '../types';
import type { StructureEdge, StructureGraph, StructureNode } from './types';

type PointerKind = 'figure' | 'table';

type PointerCandidate = {
  kind: PointerKind;
  label: string;
  uri?: string;
};

function makeNodeId(docId: string, kind: StructureNode['kind'], text: string, page: number, salt = ''): string {
  return `${kind}-${stableHash(`${docId}|${kind}|${page}|${text.trim()}|${salt}`)}`;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeInlineText(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function isSectionHeading(value: string): boolean {
  return /^(#{1,6}\s+.+|<h[1-6][^>]*>.+<\/h[1-6]>)$/i.test(value.trim());
}

function headingText(value: string): string {
  return normalizeInlineText(value.replace(/^#{1,6}\s+/, ''));
}

function extractPointers(paragraph: string): PointerCandidate[] {
  const found: PointerCandidate[] = [];
  const matches = [
    ...paragraph.matchAll(/\b(Figure|Fig\.?|Table)\s+([A-Za-z0-9._-]+)(?:\s*[:\-]\s*([^\n]+))?/gi),
    ...paragraph.matchAll(/<(figure|table)[^>]*>([\s\S]*?)<\/(figure|table)>/gi),
  ];

  for (const match of matches) {
    const token = (match[1] ?? match[3] ?? '').toLowerCase();
    const kind: PointerKind = token.startsWith('tab') ? 'table' : 'figure';
    const label = normalizeInlineText(match[2] ?? match[0]);
    const uri = match[0].match(/(?:src|href)=["']([^"']+)["']/i)?.[1];
    found.push({ kind, label, uri });
  }

  return found;
}

export function buildStructureGraph(page: ExtractedPage): StructureGraph {
  const docId = page.normalizedUrl || page.url;
  const nodes: StructureNode[] = [];
  const edges: StructureEdge[] = [];

  const sections = splitParagraphs(page.text);
  let currentSectionId = makeNodeId(docId, 'section', page.title ?? page.url, 1, 'root');
  const rootSection: StructureNode = {
    id: currentSectionId,
    docId,
    kind: 'section',
    text: page.title ?? page.url,
    page: 1,
    sourcePageId: page.id,
  };
  nodes.push(rootSection);

  let previousParagraphId: string | undefined;
  sections.forEach((chunk, index) => {
    const lines = chunk.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) {
      return;
    }

    if (isSectionHeading(lines[0])) {
      const text = headingText(lines[0]);
      currentSectionId = makeNodeId(docId, 'section', text, 1, `${index}`);
      nodes.push({
        id: currentSectionId,
        docId,
        kind: 'section',
        text,
        page: 1,
        sourcePageId: page.id,
      });
      lines.shift();
    }

    if (lines.length === 0) {
      previousParagraphId = undefined;
      return;
    }

    const paragraphText = normalizeInlineText(lines.join(' '));
    const paragraphId = makeNodeId(docId, 'paragraph', paragraphText, 1, `${index}`);
    nodes.push({
      id: paragraphId,
      docId,
      kind: 'paragraph',
      text: paragraphText,
      page: 1,
      sourcePageId: page.id,
    });
    edges.push({ from: currentSectionId, to: paragraphId, type: 'contains' });

    if (previousParagraphId) {
      edges.push({ from: previousParagraphId, to: paragraphId, type: 'near' });
    }
    previousParagraphId = paragraphId;

    for (const [pointerIndex, pointer] of extractPointers(chunk).entries()) {
      const pointerText = `${pointer.kind} ${pointer.label}`;
      const pointerId = makeNodeId(docId, pointer.kind, pointerText, 1, `${index}-${pointerIndex}`);
      nodes.push({
        id: pointerId,
        docId,
        kind: pointer.kind,
        text: pointerText,
        label: pointer.label,
        page: 1,
        sourcePageId: page.id,
        assetUri: pointer.uri,
      });
      edges.push({ from: paragraphId, to: pointerId, type: 'references' });
    }
  });

  return { nodes, edges };
}
