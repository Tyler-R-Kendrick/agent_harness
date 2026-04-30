const TRACKING_PARAMS = /^(?:utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i;

export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/u, '');
    return url.toString().replace(/\?$/u, '');
  } catch {
    return trimmed.toLowerCase();
  }
}
