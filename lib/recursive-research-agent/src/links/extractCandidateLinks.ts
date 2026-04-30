import { normalizeUrl } from '../utils/normalizeUrl';
import type { CandidateLink } from './scoreCandidateLink';

export function extractCandidateLinks(args: {
  html?: string;
  text?: string;
  pageUrl: string;
}): CandidateLink[] {
  const source = args.html ?? args.text ?? '';
  const links = [...source.matchAll(/href=["']([^"']+)["'][^>]*>([^<]*)/gi)];
  return links.map((match) => {
    const url = new URL(match[1], args.pageUrl).toString();
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
