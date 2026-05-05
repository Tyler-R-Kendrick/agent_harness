import { loadConfig } from './config.ts';
import { LocalInferenceController } from './local-inference.ts';
import { SignalingClient } from './signaling-client.ts';
import { WebRTCInferenceDaemon } from './webrtc-client.ts';
import { WebSocketInferenceDaemon } from './websocket-fallback.ts';

const MAX_RECONNECT_DELAY_MS = 30_000;

function addShutdownListeners(shutdown: () => void): void {
  const signals = Deno.build.os === 'windows' ? ['SIGINT', 'SIGBREAK'] : ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    try {
      Deno.addSignalListener(signal as Deno.Signal, shutdown);
    } catch (error) {
      console.warn(`Could not register ${signal} shutdown listener:`, error);
    }
  }
}

export async function runService(): Promise<void> {
  let reconnectDelay = 1_000;
  let currentDaemon: { close(): void } | undefined;

  const shutdown = () => {
    console.log('Stopping Agent Harness Local Inference Daemon.');
    currentDaemon?.close();
    Deno.exit(0);
  };
  addShutdownListeners(shutdown);

  while (true) {
    const config = loadConfig();
    const inference = new LocalInferenceController(config.localInferenceBaseUrl);

    try {
      console.log(`Starting Agent Harness Local Inference Daemon as ${config.peerId}.`);
      if (config.preferWebSocketFallback) {
        const daemon = new WebSocketInferenceDaemon(config, inference);
        currentDaemon = daemon;
        await daemon.connect();
        reconnectDelay = 1_000;
        await daemon.waitForClose();
      } else {
        const signaling = new SignalingClient(config.signalingUrl, config.peerId);
        const daemon = new WebRTCInferenceDaemon(config, signaling, inference);
        currentDaemon = daemon;
        await daemon.start();
        reconnectDelay = 1_000;
        await daemon.waitForClose();
      }
    } catch (error) {
      console.error('Local inference daemon connection failed:', error);
      currentDaemon?.close();
      await new Promise((resolve) => setTimeout(resolve, reconnectDelay));
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
    }
  }
}

if (import.meta.main) {
  await runService();
}
