export function normalizeHostname(source?: string): string | null {
  if (!source) return null;
  try {
    return new URL(source.startsWith('http') ? source : `https://${source}`).hostname;
  } catch {
    return null;
  }
}

export function getFaviconBadgeLabel(source?: string): string | null {
  const hostname = normalizeHostname(source) ?? source?.trim() ?? '';
  const match = hostname.match(/[a-z0-9]/i);
  return match ? match[0].toUpperCase() : null;
}
