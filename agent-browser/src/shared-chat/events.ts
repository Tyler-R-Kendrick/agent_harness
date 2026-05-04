import { withoutSignature } from './canonicalJson';
import { signCanonicalJson } from './crypto';
import { base64UrlEncode } from './encoding';
import { parseSignedSessionEvent } from './schemas';
import { sanitizeChatText } from './safeText';
import type { SessionState, SignedSessionEvent } from './types';

function randomId(prefix: string): string {
  if (crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `${prefix}-${base64UrlEncode(bytes)}`;
}

export async function createSignedEvent<TPayload>(args: {
  session: SessionState;
  privateKey: CryptoKey;
  type: SignedSessionEvent['type'];
  payload: TPayload;
  now?: number;
}): Promise<SignedSessionEvent> {
  const seq = (args.session.lastSeqByDevice[args.session.localDeviceId] ?? 0) + 1;
  const unsigned = {
    v: 1 as const,
    sessionId: args.session.sessionId,
    epoch: args.session.epoch,
    eventId: randomId('evt'),
    deviceId: args.session.localDeviceId,
    seq,
    createdAt: args.now ?? Date.now(),
    type: args.type,
    payload: args.type === 'message.created'
      ? { text: sanitizeChatText(String((args.payload as { text?: unknown }).text ?? '')) }
      : args.payload,
  };
  const signature = await signCanonicalJson(args.privateKey, unsigned);
  return parseSignedSessionEvent({ ...unsigned, signature });
}

export function markEventAccepted(session: SessionState, event: SignedSessionEvent): SessionState {
  return {
    ...session,
    ended: session.ended || event.type === 'session.ended',
    lastSeqByDevice: { ...session.lastSeqByDevice, [event.deviceId]: event.seq },
    seenEventIds: { ...session.seenEventIds, [event.eventId]: true },
  };
}

export function eventSignatureMaterial(event: SignedSessionEvent): Omit<SignedSessionEvent, 'signature'> {
  return withoutSignature(event) as Omit<SignedSessionEvent, 'signature'>;
}
