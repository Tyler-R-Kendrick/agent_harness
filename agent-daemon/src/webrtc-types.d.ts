interface RTCPeerConnectionIceEvent {
  candidate: unknown;
}

interface RTCDataChannelEvent {
  channel: RTCDataChannel;
}

interface RTCMessageEvent {
  data: unknown;
}

interface RTCDataChannel {
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onmessage: ((event: RTCMessageEvent) => void | Promise<void>) | null;
  send(data: string): void;
  close(): void;
}

interface RTCPeerConnection {
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null;
  ondatachannel: ((event: RTCDataChannelEvent) => void) | null;
  createDataChannel(label: string, options?: { ordered?: boolean }): RTCDataChannel;
  createOffer(): Promise<{ type: 'offer'; sdp?: string }>;
  createAnswer(): Promise<{ type: 'answer'; sdp?: string }>;
  setLocalDescription(description: { type: 'offer' | 'answer'; sdp?: string }): Promise<void>;
  setRemoteDescription(description: { type: 'offer' | 'answer'; sdp: string }): Promise<void>;
  addIceCandidate(candidate: unknown): Promise<void>;
  close(): void;
}

declare const RTCPeerConnection: {
  new(options?: { iceServers?: Array<Record<string, unknown>> }): RTCPeerConnection;
};
