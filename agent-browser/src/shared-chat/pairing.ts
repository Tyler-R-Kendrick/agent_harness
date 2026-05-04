import { canonicalJson, withoutSignature } from './canonicalJson';
import { importPublicKeyJwk, sha256Base64Url, signCanonicalJson, verifyCanonicalJson } from './crypto';
import type { AnswerPayload, InvitePayload } from './types';

export async function hashSdp(sdp: string): Promise<string> {
  return sha256Base64Url(sdp);
}

function codeFromDigest(base64UrlDigest: string): string {
  let accumulator = 0n;
  const bytes = new TextEncoder().encode(base64UrlDigest);
  for (const byte of bytes.slice(0, 12)) {
    accumulator = (accumulator << 8n) + BigInt(byte);
  }
  const digits = (accumulator % 100_000_000n).toString().padStart(8, '0');
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

export async function derivePairingCode(args: {
  sessionId: string;
  ownerDeviceId: string;
  joiningDeviceId: string;
  ownerPublicKey: JsonWebKey;
  joiningPublicKey: JsonWebKey;
  offerHash: string;
  answerHash: string;
}): Promise<string> {
  const material = canonicalJson(args);
  return codeFromDigest(await sha256Base64Url(material));
}

export async function signAnswerPayload(privateKey: CryptoKey, unsignedAnswer: Omit<AnswerPayload, 'signature'>): Promise<AnswerPayload> {
  return { ...unsignedAnswer, signature: await signCanonicalJson(privateKey, unsignedAnswer) };
}

export async function verifyAnswerPayload(answer: AnswerPayload): Promise<boolean> {
  const publicKey = await importPublicKeyJwk(answer.joiningPublicKey);
  return verifyCanonicalJson(publicKey, withoutSignature(answer), answer.signature);
}

export async function createInvitePayload(args: Omit<InvitePayload, 'v' | 'type' | 'offerHash'> & { offerSdp: string }): Promise<InvitePayload> {
  return {
    v: 1,
    type: 'invite',
    sessionId: args.sessionId,
    ownerDeviceId: args.ownerDeviceId,
    ownerLabel: args.ownerLabel,
    ownerPublicKey: args.ownerPublicKey,
    offer: args.offer,
    offerHash: await hashSdp(args.offerSdp),
    expiresAt: args.expiresAt,
    nonce: args.nonce,
  };
}
