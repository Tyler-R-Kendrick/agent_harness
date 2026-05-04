import { eventSignatureMaterial } from './events';
import { EVENT_CLOCK_SKEW_MS, MAX_SERIALIZED_EVENT_BYTES } from './limits';
import { PeerRateLimiter } from './rateLimit';
import { parseSignedSessionEvent } from './schemas';
import { utf8Encode } from './encoding';
import { importPublicKeyJwk, verifyCanonicalJson } from './crypto';
import type { SessionState, SignedSessionEvent } from './types';

export class ProtocolValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolValidationError';
  }
}

export async function validateInboundEvent(args: {
  event: unknown;
  session: SessionState;
  rateLimiter?: PeerRateLimiter;
  now?: number;
}): Promise<SignedSessionEvent> {
  const serialized = JSON.stringify(args.event);
  if (utf8Encode(serialized).byteLength > MAX_SERIALIZED_EVENT_BYTES) {
    throw new ProtocolValidationError('Event is too large.');
  }
  const event = parseSignedSessionEvent(args.event);
  if (event.sessionId !== args.session.sessionId) throw new ProtocolValidationError('Wrong session.');
  if (args.session.ended) throw new ProtocolValidationError('Session ended.');
  if (!args.session.pairingConfirmed) throw new ProtocolValidationError('Pairing is not confirmed.');
  if (event.epoch !== args.session.epoch) throw new ProtocolValidationError('Wrong epoch.');
  const sender = args.session.devices[event.deviceId];
  if (!sender?.approved) throw new ProtocolValidationError('Unknown or unapproved device.');
  if (sender.revoked) throw new ProtocolValidationError('Device revoked.');
  if (args.session.seenEventIds[event.eventId]) throw new ProtocolValidationError('Replay detected.');
  if (event.seq <= (args.session.lastSeqByDevice[event.deviceId] ?? 0)) throw new ProtocolValidationError('Non-monotonic sequence.');
  if (Math.abs((args.now ?? Date.now()) - event.createdAt) > EVENT_CLOCK_SKEW_MS) throw new ProtocolValidationError('Event timestamp rejected.');
  if (args.rateLimiter && !args.rateLimiter.accept(event.deviceId, args.now)) throw new ProtocolValidationError('Rate limit exceeded.');
  const publicKey = await importPublicKeyJwk(sender.publicKeyJwk);
  if (!await verifyCanonicalJson(publicKey, eventSignatureMaterial(event), event.signature)) {
    throw new ProtocolValidationError('Signature verification failed.');
  }
  return event;
}
