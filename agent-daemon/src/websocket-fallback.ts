import type { DaemonConfig } from './config.ts';
import { LocalInferenceController } from './local-inference.ts';

export class WebSocketInferenceDaemon {
  private ws?: WebSocket;
  private closePromise: Promise<void> = Promise.resolve();
  private resolveClose: () => void = () => {};
  private rejectClose: (error: Error) => void = () => {};

  constructor(private readonly config: DaemonConfig, private readonly inference: LocalInferenceController) {}

  connect(): Promise<void> {
    this.closePromise = new Promise((resolve, reject) => {
      this.resolveClose = resolve;
      this.rejectClose = reject;
    });
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.config.fallbackWebSocketUrl);
      this.ws = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'register', id: this.config.peerId, role: 'local-inference-daemon' }));
        resolve();
      };
      ws.onerror = () => {
        const error = new Error('Fallback WebSocket failed.');
        reject(error);
        this.rejectClose(error);
      };
      ws.onclose = () => this.resolveClose();
      ws.onmessage = async (event) => {
        const response = await this.inference.handleMessage(String(event.data));
        ws.send(JSON.stringify(response));
      };
    });
  }

  close(): void {
    this.ws?.close();
  }

  waitForClose(): Promise<void> {
    return this.closePromise;
  }
}
