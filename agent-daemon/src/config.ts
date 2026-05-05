export interface TurnServerConfig {
  url: string;
  username: string;
  credential: string;
}

export interface DaemonConfig {
  signalingUrl: string;
  fallbackWebSocketUrl: string;
  peerId: string;
  targetPeerId: string;
  localInferenceBaseUrl: string;
  stunServers: string[];
  turnServers: TurnServerConfig[];
  preferWebSocketFallback: boolean;
}

function readCsvEnv(name: string): string[] {
  return (Deno.env.get(name) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function loadConfig(): DaemonConfig {
  return {
    signalingUrl: Deno.env.get('AGENT_HARNESS_SIGNALING_URL') ?? 'ws://localhost:8080',
    fallbackWebSocketUrl: Deno.env.get('AGENT_HARNESS_DAEMON_WS_URL') ?? 'ws://localhost:8080/agent',
    peerId: Deno.env.get('AGENT_HARNESS_DAEMON_ID') ?? `daemon-${crypto.randomUUID()}`,
    targetPeerId: Deno.env.get('AGENT_HARNESS_WEBAPP_PEER_ID') ?? 'agent-browser',
    localInferenceBaseUrl: Deno.env.get('AGENT_HARNESS_LOCAL_INFERENCE_BASE_URL') ?? 'http://127.0.0.1:11434/v1',
    stunServers: readCsvEnv('AGENT_HARNESS_STUN_SERVERS').length > 0
      ? readCsvEnv('AGENT_HARNESS_STUN_SERVERS')
      : ['stun:stun.l.google.com:19302'],
    turnServers: [],
    preferWebSocketFallback: Deno.env.get('AGENT_HARNESS_DAEMON_TRANSPORT') === 'websocket',
  };
}
