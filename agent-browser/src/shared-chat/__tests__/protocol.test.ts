import { describe, expect, it } from 'vitest';
import {
  PeerRateLimiter,
  base64UrlDecode,
  base64UrlEncode,
  canonicalJson,
  compressSdp,
  createSignedEvent,
  derivePairingCode,
  exportPublicKeyJwk,
  generateDeviceSigningKey,
  hashSdp,
  importPublicKeyJwk,
  markEventAccepted,
  parseAnswerPayload,
  parseInvitePayload,
  parseSignedSessionEvent,
  sha256Base64Url,
  signAnswerPayload,
  signCanonicalJson,
  validateInboundEvent,
  verifyAnswerPayload,
  verifyCanonicalJson,
  decompressSdp,
  type SessionState,
} from '..';

async function makeSession() {
  const owner = await generateDeviceSigningKey();
  const joiner = await generateDeviceSigningKey();
  const ownerPublicKey = await exportPublicKeyJwk(owner.publicKey);
  const joiningPublicKey = await exportPublicKeyJwk(joiner.publicKey);
  const session: SessionState = {
    version: 1,
    sessionId: 'session-12345678',
    localDeviceId: 'dev-owner-12345678',
    ownerDeviceId: 'dev-owner-12345678',
    peerDeviceId: 'dev-joiner-12345678',
    epoch: 0,
    pairingConfirmed: true,
    devices: {
      'dev-owner-12345678': {
        deviceId: 'dev-owner-12345678',
        label: 'Owner',
        publicKeyJwk: ownerPublicKey,
        role: 'owner',
        approved: true,
        revoked: false,
        joinedAt: 1,
      },
      'dev-joiner-12345678': {
        deviceId: 'dev-joiner-12345678',
        label: 'Joiner',
        publicKeyJwk: joiningPublicKey,
        role: 'contributor',
        approved: true,
        revoked: false,
        joinedAt: 1,
      },
    },
    lastSeqByDevice: {},
    seenEventIds: {},
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
    ended: false,
  };
  return { owner, joiner, ownerPublicKey, joiningPublicKey, session };
}

describe('shared chat crypto and protocol', () => {
  it('canonicalizes JSON with stable key order and rejects unsupported values', () => {
    expect(canonicalJson({ b: 1, a: { d: 4, c: [2, 'x'] } })).toBe('{"a":{"c":[2,"x"],"d":4},"b":1}');
    expect(() => canonicalJson({ a: undefined })).toThrow(/rejects undefined/i);
    expect(() => canonicalJson(Number.NaN)).toThrow(/non-finite/i);
  });

  it('roundtrips base64url and compressed SDP payloads', async () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
    expect([...base64UrlDecode(base64UrlEncode(bytes))]).toEqual([...bytes]);
    const sdp = 'v=0\no=- 46117317 2 IN IP4 127.0.0.1\ns=agent-browser\n';
    expect(await decompressSdp(await compressSdp(sdp))).toBe(sdp);
  });

  it('hashes, signs, verifies, and rejects tampering', async () => {
    expect(await sha256Base64Url('abc')).toBe('ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0');
    const keys = await generateDeviceSigningKey();
    expect(keys.privateKey.extractable).toBe(false);
    const publicJwk = await exportPublicKeyJwk(keys.publicKey);
    const publicKey = await importPublicKeyJwk(publicJwk);
    const payload = { b: 2, a: 'signed' };
    const signature = await signCanonicalJson(keys.privateKey, payload);
    expect(await verifyCanonicalJson(publicKey, { a: 'signed', b: 2 }, signature)).toBe(true);
    expect(await verifyCanonicalJson(publicKey, { a: 'tampered', b: 2 }, signature)).toBe(false);
  });

  it('validates invite and answer schemas and answer signatures', async () => {
    const { joiner, joiningPublicKey, ownerPublicKey } = await makeSession();
    const invite = parseInvitePayload({
      v: 1,
      type: 'invite',
      sessionId: 'session-12345678',
      ownerDeviceId: 'dev-owner-12345678',
      ownerLabel: 'Owner',
      ownerPublicKey,
      offer: 'offer',
      offerHash: await hashSdp('offer-sdp'),
      expiresAt: Date.now() + 60_000,
      nonce: 'nonce-1234567890123456',
    });
    expect(invite.type).toBe('invite');
    const answer = await signAnswerPayload(joiner.privateKey, {
      v: 1,
      type: 'answer',
      sessionId: invite.sessionId,
      joiningDeviceId: 'dev-joiner-12345678',
      joiningLabel: 'Joiner',
      joiningPublicKey,
      answer: 'answer',
      answerHash: await hashSdp('answer-sdp'),
      expiresAt: Date.now() + 60_000,
      nonce: 'nonce-abcdef1234567890',
    });
    expect(parseAnswerPayload(answer).type).toBe('answer');
    expect(await verifyAnswerPayload(answer)).toBe(true);
    expect(await verifyAnswerPayload({ ...answer, answerHash: await hashSdp('changed') })).toBe(false);
    expect(() => parseInvitePayload({ ...invite, extra: true })).toThrow();
  });

  it('derives equal pairing codes on both sides and changes on tamper', async () => {
    const { ownerPublicKey, joiningPublicKey } = await makeSession();
    const args = {
      sessionId: 'session-12345678',
      ownerDeviceId: 'dev-owner-12345678',
      joiningDeviceId: 'dev-joiner-12345678',
      ownerPublicKey,
      joiningPublicKey,
      offerHash: await hashSdp('offer'),
      answerHash: await hashSdp('answer'),
    };
    const left = await derivePairingCode(args);
    const right = await derivePairingCode({ ...args });
    expect(left).toMatch(/^\d{4}-\d{4}$/u);
    expect(left).toBe(right);
    await expect(derivePairingCode({ ...args, answerHash: await hashSdp('tampered') })).resolves.not.toBe(left);
    await expect(derivePairingCode({ ...args, joiningPublicKey: { ...joiningPublicKey, x: 'tampered' } })).resolves.not.toBe(left);
  });

  it('validates signed events and rejects replay, sequence, unknown, revoked, and oversized messages', async () => {
    const { joiner, session } = await makeSession();
    const inboundSession = { ...session, localDeviceId: 'dev-owner-12345678' };
    const event = await createSignedEvent({
      session: { ...session, localDeviceId: 'dev-joiner-12345678' },
      privateKey: joiner.privateKey,
      type: 'message.created',
      payload: { text: 'hello' },
      now: Date.now(),
    });
    expect(parseSignedSessionEvent(event).type).toBe('message.created');
    await expect(validateInboundEvent({ event, session: { ...inboundSession, pairingConfirmed: false } })).rejects.toThrow(/pairing/i);
    await expect(validateInboundEvent({ event, session: inboundSession, rateLimiter: new PeerRateLimiter() })).resolves.toEqual(event);
    const accepted = markEventAccepted(inboundSession, event);
    await expect(validateInboundEvent({ event, session: accepted })).rejects.toThrow(/replay/i);
    await expect(validateInboundEvent({ event: { ...event, eventId: 'evt-new-123456789', seq: 1 }, session: accepted })).rejects.toThrow(/sequence/i);
    const unknown = { ...event, eventId: 'evt-unknown-123456789', deviceId: 'dev-unknown-12345678', seq: 2 };
    await expect(validateInboundEvent({ event: unknown, session: inboundSession })).rejects.toThrow(/unknown/i);
    const revoked = {
      ...inboundSession,
      devices: {
        ...inboundSession.devices,
        'dev-joiner-12345678': { ...inboundSession.devices['dev-joiner-12345678'], revoked: true },
      },
    };
    await expect(validateInboundEvent({ event, session: revoked })).rejects.toThrow(/revoked/i);
    await expect(createSignedEvent({
      session: { ...session, localDeviceId: 'dev-joiner-12345678' },
      privateKey: joiner.privateKey,
      type: 'message.created',
      payload: { text: 'x'.repeat(8_001) },
    })).rejects.toThrow();
  });
});
