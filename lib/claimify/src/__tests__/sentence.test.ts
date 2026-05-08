import { describe, expect, it, vi } from 'vitest';
import { buildExcerpt, splitSentences } from '../sentence';

describe('sentence utilities', () => {
  it('splits sentences with Intl.Segmenter when available', () => {
    const Segmenter = vi.fn(() => ({
      segment: () => [
        { segment: 'First sentence. ' },
        { segment: 'Second sentence! ' },
        { segment: 'Third sentence?' },
      ],
    }));
    vi.stubGlobal('Intl', { ...Intl, Segmenter });

    expect(splitSentences('First sentence. Second sentence! Third sentence?')).toEqual([
      'First sentence.',
      'Second sentence!',
      'Third sentence?',
    ]);
  });

  it('falls back to conservative punctuation splitting', () => {
    vi.stubGlobal('Intl', { ...Intl, Segmenter: undefined });

    expect(splitSentences('Alpha Inc. grew 12%. It hired 50 people.')).toEqual([
      'Alpha Inc. grew 12%.',
      'It hired 50 people.',
    ]);
  });

  it('builds metadata-rich excerpts and marks the target sentence', () => {
    const excerpt = buildExcerpt(
      ['Intro sentence.', 'Target sentence.', 'Next sentence.', 'Final sentence.'],
      1,
      1,
      1,
      {
        headings: ['Earnings', 'Q4'],
        sourceName: 'Contoso report',
        generatedAt: '2026-05-07',
      },
    );

    expect(excerpt).toContain('Headings: Earnings > Q4');
    expect(excerpt).toContain('Source: Contoso report');
    expect(excerpt).toContain('Generated at: 2026-05-07');
    expect(excerpt).toContain('[0] Intro sentence.');
    expect(excerpt).toContain('[TARGET 1] Target sentence.');
    expect(excerpt).toContain('[2] Next sentence.');
    expect(excerpt).not.toContain('Final sentence.');
  });
});
