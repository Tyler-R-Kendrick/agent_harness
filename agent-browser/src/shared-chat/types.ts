export type SessionId = string;
export type DeviceId = string;
export type EventId = string;

export type DeviceRecord = {
  deviceId: DeviceId;
  label: string;
  publicKeyJwk: JsonWebKey;
  role: 'owner' | 'contributor';
  approved: boolean;
  revoked: boolean;
  joinedAt: number;
};

export type SessionState = {
  version: 1;
  sessionId: SessionId;
  localDeviceId: DeviceId;
  ownerDeviceId: DeviceId;
  peerDeviceId?: DeviceId;
  epoch: number;
  pairingConfirmed: boolean;
  devices: Record<DeviceId, DeviceRecord>;
  lastSeqByDevice: Record<DeviceId, number>;
  seenEventIds: Record<EventId, true>;
  createdAt: number;
  expiresAt: number;
  ended: boolean;
};

export type InvitePayload = {
  v: 1;
  type: 'invite';
  sessionId: SessionId;
  ownerDeviceId: DeviceId;
  ownerLabel: string;
  ownerPublicKey: JsonWebKey;
  offer: string;
  offerHash: string;
  expiresAt: number;
  nonce: string;
};

export type AnswerPayload = {
  v: 1;
  type: 'answer';
  sessionId: SessionId;
  joiningDeviceId: DeviceId;
  joiningLabel: string;
  joiningPublicKey: JsonWebKey;
  answer: string;
  answerHash: string;
  expiresAt: number;
  nonce: string;
  signature: string;
};

export type BaseSignedEvent = {
  v: 1;
  sessionId: SessionId;
  epoch: number;
  eventId: EventId;
  deviceId: DeviceId;
  seq: number;
  createdAt: number;
  signature: string;
};

export type MessageCreatedEvent = BaseSignedEvent & {
  type: 'message.created';
  payload: { text: string };
};

export type SessionEndedEvent = BaseSignedEvent & {
  type: 'session.ended';
  payload: { reason: 'user_requested' | 'protocol_error' };
};

export type ProtocolErrorEvent = BaseSignedEvent & {
  type: 'protocol.error';
  payload: { code: string; message: string };
};

export type SignedSessionEvent = MessageCreatedEvent | SessionEndedEvent | ProtocolErrorEvent;
