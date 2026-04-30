export function domainFromUrl(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return undefined;
  }
}

export function isSameDomain(a: string, b: string): boolean {
  const left = domainFromUrl(a) ?? a.replace(/^www\./i, '').toLowerCase();
  const right = domainFromUrl(b) ?? b.replace(/^www\./i, '').toLowerCase();
  return left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`);
}

export function isLikelyAuthorityUrl(url: string): boolean {
  const domain = domainFromUrl(url) ?? '';
  const path = safePath(url);
  return /\.edu$/i.test(domain)
    || /\.gov$/i.test(domain)
    || /(?:^|\.)github\.com$/i.test(domain)
    || /(?:^|\.)arxiv\.org$/i.test(domain)
    || /(?:^|\.)doi\.org$/i.test(domain)
    || /\b(?:docs?|documentation|spec|standards?|reference|research|paper)\b/i.test(path);
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
