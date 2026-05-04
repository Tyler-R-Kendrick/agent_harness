import { z } from 'zod';
import { MAX_CHAT_MESSAGE_TEXT_LENGTH } from './limits';
import type { AnswerPayload, InvitePayload, SignedSessionEvent } from './types';

const jwkSchema = z.object({
  kty: z.string(),
  crv: z.string().optional(),
  x: z.string().optional(),
  y: z.string().optional(),
  ext: z.boolean().optional(),
  key_ops: z.array(z.string()).optional(),
}).strict().passthrough();

const basePayload = {
  v: z.literal(1),
  sessionId: z.string().min(8).max(128),
  expiresAt: z.number().int().positive(),
  nonce: z.string().min(16).max(256),
};

export const invitePayloadSchema = z.object({
  ...basePayload,
  type: z.literal('invite'),
  ownerDeviceId: z.string().min(8).max(128),
  ownerLabel: z.string().min(1).max(80),
  ownerPublicKey: jwkSchema,
  offer: z.string().min(1),
  offerHash: z.string().min(32).max(128),
}).strict();

export const answerPayloadUnsignedSchema = z.object({
  ...basePayload,
  type: z.literal('answer'),
  joiningDeviceId: z.string().min(8).max(128),
  joiningLabel: z.string().min(1).max(80),
  joiningPublicKey: jwkSchema,
  answer: z.string().min(1),
  answerHash: z.string().min(32).max(128),
}).strict();

export const answerPayloadSchema = answerPayloadUnsignedSchema.extend({
  signature: z.string().min(32),
}).strict();

const baseEventSchema = z.object({
  v: z.literal(1),
  sessionId: z.string().min(8).max(128),
  epoch: z.number().int().nonnegative(),
  eventId: z.string().min(16).max(128),
  deviceId: z.string().min(8).max(128),
  seq: z.number().int().positive(),
  createdAt: z.number().int().positive(),
  signature: z.string().min(32),
}).strict();

export const messageCreatedEventSchema = baseEventSchema.extend({
  type: z.literal('message.created'),
  payload: z.object({
    text: z.string().min(1).max(MAX_CHAT_MESSAGE_TEXT_LENGTH),
  }).strict(),
}).strict();

export const sessionEndedEventSchema = baseEventSchema.extend({
  type: z.literal('session.ended'),
  payload: z.object({
    reason: z.enum(['user_requested', 'protocol_error']),
  }).strict(),
}).strict();

export const protocolErrorEventSchema = baseEventSchema.extend({
  type: z.literal('protocol.error'),
  payload: z.object({
    code: z.string().min(1).max(80),
    message: z.string().min(1).max(240),
  }).strict(),
}).strict();

export const signedSessionEventSchema = z.discriminatedUnion('type', [
  messageCreatedEventSchema,
  sessionEndedEventSchema,
  protocolErrorEventSchema,
]);

export function parseInvitePayload(value: unknown): InvitePayload {
  return invitePayloadSchema.parse(value) as InvitePayload;
}

export function parseAnswerPayload(value: unknown): AnswerPayload {
  return answerPayloadSchema.parse(value) as AnswerPayload;
}

export function parseSignedSessionEvent(value: unknown): SignedSessionEvent {
  return signedSessionEventSchema.parse(value) as SignedSessionEvent;
}
