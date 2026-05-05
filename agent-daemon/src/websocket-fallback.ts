import type { DaemonConfig } from './config.ts';
import { LocalInferenceController } from './local-inference.ts';

export class WebSocketInferenceDaemon {
  private ws?: WebSocket;

  constructor(private readonly config: DaemonConfig, private readonly inference: LocalInferenceController) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.config.fallbackWebSocketUrl);
      this.ws = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'register', id: this.config.peerId, role: 'local-inference-daemon' }));
        resolve();
      };
      ws.onerror = () => reject(new Error('Fallback WebSocket failed to connect.'));
      ws.onmessage = async (event) => {
        const response = await this.inference.handleMessage(String(event.data));
        ws.send(JSON.stringify(response));
      };
    });
  }

  close(): void {
    this.ws?.close();
  }
}
