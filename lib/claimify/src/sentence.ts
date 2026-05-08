import type { ClaimExtractionInput } from './types';

const ABBREVIATIONS = ['Inc.', 'Ltd.', 'Corp.', 'Co.', 'Dr.', 'Mr.', 'Mrs.', 'Ms.', 'U.S.', 'U.K.'];

export function splitSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  const segmenter = getSegmenter();
  if (segmenter) {
    return Array.from(segmenter.segment(trimmed), (entry) => entry.segment.trim()).filter(Boolean);
  }

  const protectedText = ABBREVIATIONS.reduce(
    (current, abbreviation, index) => current.replaceAll(abbreviation, `__ABBR_${index}__`),
    trimmed,
  );

  return protectedText
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"[(])/u)
    .map((sentence) =>
      ABBREVIATIONS.reduce(
        (current, abbreviation, index) => current.replaceAll(`__ABBR_${index}__`, abbreviation),
        sentence,
      ).trim(),
    )
    .filter(Boolean);
}

export function buildExcerpt(
  sentences: string[],
  index: number,
  before = 1,
  after = 1,
  metadata: ClaimExtractionInput['metadata'] = {},
): string {
  const lines: string[] = [];
  const headings = metadata?.headings?.filter(Boolean) ?? [];
  if (headings.length > 0) {
    lines.push(`Headings: ${headings.join(' > ')}`);
  }
  if (metadata?.sourceName) {
    lines.push(`Source: ${metadata.sourceName}`);
  }
  if (metadata?.generatedAt) {
    lines.push(`Generated at: ${metadata.generatedAt}`);
  }

  const start = Math.max(0, index - Math.max(0, before));
  const end = Math.min(sentences.length - 1, index + Math.max(0, after));
  for (let sentenceIndex = start; sentenceIndex <= end; sentenceIndex += 1) {
    const marker = sentenceIndex === index ? `[TARGET ${sentenceIndex}]` : `[${sentenceIndex}]`;
    lines.push(`${marker} ${sentences[sentenceIndex]}`);
  }

  return lines.join('\n');
}

function getSegmenter(): Intl.Segmenter | null {
  const Segmenter = Intl.Segmenter;
  if (typeof Segmenter !== 'function') {
    return null;
  }
  return new Segmenter(undefined, { granularity: 'sentence' });
}
