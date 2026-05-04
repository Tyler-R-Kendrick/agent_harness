export const MAX_CHAT_MESSAGE_TEXT_LENGTH = 8_000;
export const MAX_SERIALIZED_EVENT_BYTES = 64 * 1024;
export const MAX_INBOUND_EVENTS_PER_SECOND = 20;
export const MAX_QUEUED_OUTBOUND_BYTES = 8 * 1024 * 1024;
// Ten minutes allows manually paired mobile/desktop browsers with modest clock drift.
// Replay protection still requires unique event IDs and monotonic per-device sequence numbers.
export const EVENT_CLOCK_SKEW_MS = 10 * 60 * 1000;
