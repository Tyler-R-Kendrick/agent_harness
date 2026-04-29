import { describe, expect, it } from 'vitest';
import { getFaviconBadgeLabel, normalizeHostname } from './favicon';

describe('normalizeHostname', () => {
  it('extracts a hostname from a full url', () => {
    expect(normalizeHostname('https://example.com/docs?q=1')).toBe('example.com');
  });

  it('treats bare domains as https urls for parsing', () => {
    expect(normalizeHostname('openreview.net/forum')).toBe('openreview.net');
  });

  it('supports localhost without leaking it to a third party', () => {
    expect(normalizeHostname('http://localhost:4173')).toBe('localhost');
  });

  it('returns null for malformed values', () => {
    expect(normalizeHostname('not a valid host name ???')).toBeNull();
  });
});

describe('getFaviconBadgeLabel', () => {
  it('uses the first alphanumeric character from the hostname', () => {
    expect(getFaviconBadgeLabel('https://example.com')).toBe('E');
  });

  it('uses the original source text when the hostname cannot be parsed', () => {
    expect(getFaviconBadgeLabel('  ???docs')).toBe('D');
  });

  it('returns null when no badge text can be derived', () => {
    expect(getFaviconBadgeLabel('   ')).toBeNull();
  });
});
