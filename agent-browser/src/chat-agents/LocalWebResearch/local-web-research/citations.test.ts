import { buildCitationNavigationUrl, buildCitationPointerAriaLabel, formatCitationPointerLabel } from './citations';

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
});
