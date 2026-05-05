/// <reference path="./webrtc-types.d.ts" />

import type { DaemonConfig } from './config.ts';
import { LocalInferenceController } from './local-inference.ts';
import { SignalingClient } from './signaling-client.ts';

export class WebRTCInferenceDaemon {
  private readonly peerConnection: RTCPeerConnection;
  private dataChannel?: RTCDataChannel;
  private closePromise: Promise<void>;
  private resolveClose: () => void = () => {};

  constructor(
    private readonly config: DaemonConfig,
    private readonly signaling: SignalingClient,
    private readonly inference: LocalInferenceController,
  ) {
    this.closePromise = new Promise((resolve) => {
      this.resolveClose = resolve;
    });
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        ...config.stunServers.map((url) => ({ urls: url })),
        ...config.turnServers.map((server) => ({
          urls: server.url,
          username: server.username,
          credential: server.credential,
        })),
      ],
    });
    this.setupPeerConnection();
    this.setupSignaling();
  }

  async start(): Promise<void> {
    await this.signaling.connect();
    this.dataChannel = this.peerConnection.createDataChannel('agent-harness-local-inference', { ordered: true });
    this.setupDataChannel(this.dataChannel);
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    this.signaling.sendOffer(this.config.targetPeerId, offer.sdp ?? '');
  }

  close(): void {
    this.dataChannel?.close();
    this.peerConnection.close();
    this.signaling.close();
    this.resolveClose();
  }

  waitForClose(): Promise<void> {
    return this.closePromise;
  }

  private setupPeerConnection(): void {
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendIceCandidate(this.config.targetPeerId, JSON.stringify(event.candidate));
      }
    };
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel(event.channel);
    };
    this.peerConnection.onconnectionstatechange = () => {
      if (['closed', 'disconnected', 'failed'].includes(this.peerConnection.connectionState)) {
        this.resolveClose();
      }
    };
  }

  private setupSignaling(): void {
    this.signaling.onOffer(async (sdp) => {
      await this.peerConnection.setRemoteDescription({ type: 'offer', sdp });
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      this.signaling.sendAnswer(this.config.targetPeerId, answer.sdp ?? '');
    });
    this.signaling.onAnswer(async (sdp) => {
      await this.peerConnection.setRemoteDescription({ type: 'answer', sdp });
    });
    this.signaling.onIceCandidate(async (candidate) => {
      await this.peerConnection.addIceCandidate(JSON.parse(candidate));
    });
  }

  private setupDataChannel(channel: RTCDataChannel): void {
    channel.onopen = () => console.log('Local inference data channel opened.');
    channel.onclose = () => {
      console.log('Local inference data channel closed.');
      this.resolveClose();
    };
    channel.onmessage = async (event) => {
      const response = await this.inference.handleMessage(String(event.data));
      channel.send(JSON.stringify(response));
    };
  }
}
