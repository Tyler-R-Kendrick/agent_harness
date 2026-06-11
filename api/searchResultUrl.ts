export function normalizeSearchResultUrl(value: string, baseUrl: string): string | null {
  const resolved = resolveProviderUrl(value, baseUrl);
  const normalized = normalizeRedirectUrl(resolved);
  if (!normalized) return null;
  return /^https?:\/\//i.test(normalized) ? normalized : null;
}

function resolveProviderUrl(value: string, baseUrl: string): string {
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : value;
  } catch {
    return value;
  }
}

function normalizeRedirectUrl(url: string): string | null {
  const duckDuckGoUrl = decodeDuckDuckGoRedirect(url);
  if (duckDuckGoUrl !== undefined) return duckDuckGoUrl;
  const bingUrl = decodeBingRedirect(url);
  if (bingUrl !== undefined) return bingUrl;
  return url;
}

function decodeDuckDuckGoRedirect(url: string): string | null | undefined {
  if (!url.includes('uddg=')) return undefined;
  try {
    const parsed = new URL(url, 'https://duckduckgo.com');
    const target = parsed.searchParams.get('uddg');
    return target ? decodeURIComponent(target) : null;
  } catch {
    return null;
  }
}

function decodeBingRedirect(url: string): string | null | undefined {
  if (!/https?:\/\/(?:www\.)?bing\.com\/ck\/a/i.test(url) && !url.includes('bing.com/ck/a')) {
    return undefined;
  }
  try {
    const parsed = new URL(url, 'https://www.bing.com');
    const encoded = parsed.searchParams.get('u');
    if (!encoded) return null;
    return decodeBingEncodedUrl(encoded);
  } catch {
    return null;
  }
}

function decodeBingEncodedUrl(encoded: string): string | null {
  const candidates = [encoded, encoded.startsWith('a1') ? encoded.slice(2) : encoded];
  for (const candidate of candidates) {
    const normalized = candidate.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(normalized, 'base64').toString('utf8');
    if (/^https?:\/\//i.test(decoded)) return decoded;
  }
  try {
    const decoded = decodeURIComponent(encoded);
    return /^https?:\/\//i.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}
