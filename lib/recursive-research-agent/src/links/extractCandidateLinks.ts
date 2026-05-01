import { normalizeUrl } from '../utils/normalizeUrl';
import type { CandidateLink } from './scoreCandidateLink';

export function extractCandidateLinks(args: {
  html?: string;
  text?: string;
  pageUrl: string;
}): CandidateLink[] {
  const source = args.html ?? args.text ?? '';
  const links = [...source.matchAll(/href=["']([^"']+)["'][^>]*>([^<]*)/gi)];
  return links.flatMap((match) => {
    const url = resolveFetchableUrl(match[1], args.pageUrl);
    if (!url) return [];

    return {
      url,
      normalizedUrl: normalizeUrl(url),
      anchorText: match[2]?.trim(),
      sourcePageUrl: args.pageUrl,
      score: 0,
      reason: 'Unscored candidate link.',
    };
  });
}

function resolveFetchableUrl(value: string, pageUrl: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('#')) return undefined;

  try {
    const url = new URL(trimmed, pageUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
