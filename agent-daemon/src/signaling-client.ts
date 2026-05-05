type MessageHandler = (payload: string) => void | Promise<void>;

export class SignalingClient {
  private ws?: WebSocket;
  private onOfferHandler?: MessageHandler;
  private onAnswerHandler?: MessageHandler;
  private onIceCandidateHandler?: MessageHandler;

  constructor(private readonly url: string, private readonly peerId: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'register', peerId: this.peerId }));
        resolve();
      };
      ws.onerror = () => reject(new Error('Signaling WebSocket failed to connect.'));
      ws.onmessage = (event) => this.handleMessage(String(event.data));
    });
  }

  close(): void {
    this.ws?.close();
  }

  sendOffer(target: string, sdp: string): void {
    this.send({ type: 'offer', target, sdp });
  }

  sendAnswer(target: string, sdp: string): void {
    this.send({ type: 'answer', target, sdp });
  }

  sendIceCandidate(target: string, candidate: string): void {
    this.send({ type: 'candidate', target, candidate });
  }

  onOffer(handler: MessageHandler): void {
    this.onOfferHandler = handler;
  }

  onAnswer(handler: MessageHandler): void {
    this.onAnswerHandler = handler;
  }

  onIceCandidate(handler: MessageHandler): void {
    this.onIceCandidateHandler = handler;
  }

  private send(message: Record<string, unknown>): void {
    this.ws?.send(JSON.stringify(message));
  }

  private async handleMessage(data: string): Promise<void> {
    const message = JSON.parse(data) as { type?: string; sdp?: string; candidate?: string };
    if (message.type === 'offer' && message.sdp) await this.onOfferHandler?.(message.sdp);
    if (message.type === 'answer' && message.sdp) await this.onAnswerHandler?.(message.sdp);
    if (message.type === 'candidate' && message.candidate) await this.onIceCandidateHandler?.(message.candidate);
  }
}
