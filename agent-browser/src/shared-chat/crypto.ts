import { canonicalJson } from './canonicalJson';
import { base64UrlDecode, base64UrlEncode, utf8Encode } from './encoding';

function getSubtle(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WebCrypto is not available.');
  }
  return globalThis.crypto.subtle;
}

function asBufferSource(value: Uint8Array): BufferSource {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

export async function generateDeviceSigningKey(): Promise<CryptoKeyPair> {
  return getSubtle().generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
}

export async function exportPublicKeyJwk(publicKey: CryptoKey): Promise<JsonWebKey> {
  return getSubtle().exportKey('jwk', publicKey);
}

export async function importPublicKeyJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return getSubtle().importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
}

export async function signCanonicalJson(privateKey: CryptoKey, value: unknown): Promise<string> {
  const signature = await getSubtle().sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, asBufferSource(utf8Encode(canonicalJson(value))));
  return base64UrlEncode(new Uint8Array(signature));
}

export async function verifyCanonicalJson(publicKey: CryptoKey, value: unknown, signature: string): Promise<boolean> {
  try {
    return await getSubtle().verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      asBufferSource(base64UrlDecode(signature)),
      asBufferSource(utf8Encode(canonicalJson(value))),
    );
  } catch {
    return false;
  }
}

export async function sha256Base64Url(value: Uint8Array | string): Promise<string> {
  const bytes = typeof value === 'string' ? utf8Encode(value) : value;
  const digest = await getSubtle().digest('SHA-256', asBufferSource(bytes));
  return base64UrlEncode(new Uint8Array(digest));
}
