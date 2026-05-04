import { MAX_INBOUND_EVENTS_PER_SECOND } from './limits';

export class PeerRateLimiter {
  private readonly buckets = new Map<string, number[]>();

  accept(deviceId: string, now = Date.now()): boolean {
    const cutoff = now - 1000;
    const bucket = (this.buckets.get(deviceId) ?? []).filter((entry) => entry >= cutoff);
    if (bucket.length >= MAX_INBOUND_EVENTS_PER_SECOND) {
      this.buckets.set(deviceId, bucket);
      return false;
    }
    bucket.push(now);
    this.buckets.set(deviceId, bucket);
    return true;
  }
}
