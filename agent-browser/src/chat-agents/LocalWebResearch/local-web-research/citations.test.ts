import {
  buildCitationAssetNavigationTarget,
  buildCitationNavigationUrl,
  buildCitationPointerAriaLabel,
  buildCitations,
  formatCitationPointerLabel,
} from './citations';

describe('citation pointer metadata', () => {
  it('renders mixed pointer metadata labels for figure/table and page numbers', () => {
    expect(formatCitationPointerLabel({ pointerType: 'figure', pointerLabel: '2', pageNumber: 10 })).toBe('figure 2 · page 10');
    expect(formatCitationPointerLabel({ pointerType: 'table', pointerLabel: '4' })).toBe('table 4');
    expect(formatCitationPointerLabel({ pageNumber: 3 })).toBe('page 3');
  });

  it('falls back to URL-only rendering when pointer fields are absent', () => {
    expect(formatCitationPointerLabel({})).toBeNull();
    expect(buildCitationNavigationUrl({ url: 'https://example.com/report' })).toBe('https://example.com/report');
  });

  it('builds pointer-aware navigation URLs when an anchor is present', () => {
    expect(buildCitationNavigationUrl({ url: 'https://example.com/report', pointerAnchor: 'figure-2' })).toBe('https://example.com/report#figure-2');
    expect(buildCitationNavigationUrl({ url: 'https://example.com/report#old', pointerAnchor: 'table-1' })).toBe('https://example.com/report#table-1');
  });

  it('builds accessibility-first pointer action labels', () => {
    expect(buildCitationPointerAriaLabel({ pointerType: 'figure', pointerLabel: '2', pageNumber: 10 })).toBe('Open figure citation 2 on page 10');
    expect(buildCitationPointerAriaLabel({ pageNumber: 4 })).toBe('Open citation on page 4');
    expect(buildCitationPointerAriaLabel({})).toBe('Open citation source');
  });

  it('assigns stable ids across text evidence and pointer bundles', () => {
    const { evidence, citations } = buildCitations([
      {
        id: 'e1',
        url: 'https://example.com/report',
        normalizedUrl: 'https://example.com/report',
        text: 'alpha',
        score: 1,
      },
      {
        id: 'e2',
        url: 'https://example.com/report',
        normalizedUrl: 'https://example.com/report',
        text: 'beta',
        score: 0.9,
        pointerType: 'figure',
        pointerLabel: '2',
        pointerAnchor: 'figure-2',
        pageNumber: 5,
      },
      {
        id: 'e3',
        url: 'https://example.com/report',
        normalizedUrl: 'https://example.com/report',
        text: 'beta 2',
        score: 0.8,
        pointerType: 'figure',
        pointerLabel: '2',
        pointerAnchor: 'figure-2',
        pageNumber: 5,
      },
    ]);
    expect(evidence.map((chunk) => chunk.citationId)).toEqual([1, 2, 2]);
    expect(citations).toEqual([
      expect.objectContaining({ id: 1, kind: 'text', normalizedUrl: 'https://example.com/report' }),
      expect.objectContaining({
        id: 2,
        kind: 'pointer',
        normalizedUrl: 'https://example.com/report',
        pointerType: 'figure',
        pointerLabel: '2',
        pointerAnchor: 'figure-2',
        page: 5,
      }),
    ]);
  });

  it('builds asset navigation targets for pointer-rich citations', () => {
    expect(buildCitationAssetNavigationTarget({ assetUri: 'https://example.com/assets/report.pdf', assetAnchor: 'page=5' })).toBe(
      'https://example.com/assets/report.pdf#page=5',
    );
    expect(buildCitationAssetNavigationTarget({ assetUri: 'https://example.com/assets/report.pdf' })).toBe(
      'https://example.com/assets/report.pdf',
    );
    expect(buildCitationAssetNavigationTarget({})).toBeNull();
  });
});
