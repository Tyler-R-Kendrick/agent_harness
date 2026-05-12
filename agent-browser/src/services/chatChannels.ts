import type {
  HarnessPluginChannelCapability,
  HarnessPluginChannelKind,
} from 'harness-core';
import type { DefaultExtensionRuntime } from './defaultExtensions';

export interface ChatChannelOption {
  id: string;
  label: string;
  kind: HarnessPluginChannelKind;
  capabilities: HarnessPluginChannelCapability[];
  description: string;
  extensionId?: string;
  builtIn?: boolean;
  configuration?: Record<string, unknown>;
}

export interface ChatChannelHandoffSession {
  sessionId: string;
  workspaceName: string;
  issuedAt?: string | Date;
}

export interface ChatChannelHandoffPayload {
  type: 'agent-harness.chat-channel-handoff';
  version: 1;
  channel: {
    id: string;
    label: string;
    kind: HarnessPluginChannelKind;
    extensionId?: string;
  };
  session: {
    id: string;
    workspaceName: string;
  };
  capabilities: HarnessPluginChannelCapability[];
  issuedAt: string;
}

export const DEFAULT_WEBRTC_CHAT_CHANNEL: ChatChannelOption = {
  id: 'builtin.webrtc',
  label: 'WebRTC peer',
  kind: 'webrtc',
  capabilities: ['delegate', 'continue', 'presence'],
  description: 'Pair another Agent Browser over QR-signaled WebRTC DataChannels.',
  builtIn: true,
};

export function buildChatChannelOptions(runtime: DefaultExtensionRuntime | null): ChatChannelOption[] {
  const options = [DEFAULT_WEBRTC_CHAT_CHANNEL];
  if (!runtime) return options;

  const installedIds = new Set(runtime.installedExtensionIds);
  for (const extension of runtime.extensions) {
    if (!installedIds.has(extension.manifest.id)) continue;
    for (const channel of extension.manifest.contributes?.channels ?? []) {
      options.push({
        id: `${extension.manifest.id}:${channel.id}`,
        label: channel.label,
        kind: channel.kind,
        capabilities: [...channel.capabilities],
        description: channel.description ?? extension.manifest.description,
        extensionId: extension.manifest.id,
        configuration: channel.configuration,
      });
    }
  }

  return dedupeById(options);
}

export function buildChatChannelHandoffPayload(
  channel: ChatChannelOption,
  session: ChatChannelHandoffSession,
): ChatChannelHandoffPayload {
  const issuedAt = session.issuedAt instanceof Date
    ? session.issuedAt.toISOString()
    : session.issuedAt ?? new Date().toISOString();
  return {
    type: 'agent-harness.chat-channel-handoff',
    version: 1,
    channel: {
      id: channel.id,
      label: channel.label,
      kind: channel.kind,
      ...(channel.extensionId ? { extensionId: channel.extensionId } : {}),
    },
    session: {
      id: session.sessionId,
      workspaceName: session.workspaceName,
    },
    capabilities: [...channel.capabilities],
    issuedAt,
  };
}

export function formatChatChannelHandoffMessage(payload: ChatChannelHandoffPayload): string {
  return [
    `Continue Agent Browser chat session "${payload.session.id}" from ${payload.session.workspaceName}.`,
    `Channel: ${payload.channel.label} (${payload.channel.kind}).`,
    'Handoff payload:',
    JSON.stringify(payload, null, 2),
  ].join('\n');
}

function dedupeById(options: ChatChannelOption[]): ChatChannelOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.id)) return false;
    seen.add(option.id);
    return true;
  });
}
