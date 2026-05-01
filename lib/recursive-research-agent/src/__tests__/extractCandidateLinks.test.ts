import { describe, expect, it } from 'vitest';
import { extractCandidateLinks } from '../links/extractCandidateLinks';

describe('extractCandidateLinks', () => {
  it('returns only fetchable http and https candidates', () => {
    const links = extractCandidateLinks({
      pageUrl: 'https://example.com/base/page',
      html: [
        '<a href="/docs">Docs</a>',
        '<a href="https://docs.example.com/reference">Reference</a>',
        '<a href="mailto:team@example.com">Email</a>',
        '<a href="javascript:void(0)">Open menu</a>',
        '<a href="#section">Same page</a>',
        '<a href="http://[::1">Broken</a>',
      ].join(''),
    });

    expect(links.map((link) => link.url)).toEqual([
      'https://example.com/docs',
      'https://docs.example.com/reference',
    ]);
    expect(links.every((link) => /^https?:\/\//u.test(link.normalizedUrl))).toBe(true);
  });
});
