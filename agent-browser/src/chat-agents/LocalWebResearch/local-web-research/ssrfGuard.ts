const PRIVATE_HOSTS = new Set(['localhost', '0.0.0.0', '::1']);

export async function assertPublicHttpUrl(
  url: string,
  options: { allowPrivateUrlExtraction?: boolean } = {},
): Promise<void> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs can be extracted.');
  }
  if (options.allowPrivateUrlExtraction) return;

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (PRIVATE_HOSTS.has(hostname) || hostname.endsWith('.localhost')) {
    throw new Error(`Private URL extraction is disabled for ${hostname}.`);
  }
  if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) {
    throw new Error(`Private URL extraction is disabled for ${hostname}.`);
  }
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [first, second] = parts;
  return first === 10
    || first === 127
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 169 && second === 254);
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe8')
    || normalized.startsWith('fe9')
    || normalized.startsWith('fea')
    || normalized.startsWith('feb');
}
