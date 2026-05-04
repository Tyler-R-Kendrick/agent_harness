import { base64UrlEncode } from './encoding';

export function secureRandomToken(prefix?: string): string {
  const token = crypto.randomUUID ? crypto.randomUUID() : randomBytesToken();
  return prefix ? `${prefix}-${token}` : token;
}

function randomBytesToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}
