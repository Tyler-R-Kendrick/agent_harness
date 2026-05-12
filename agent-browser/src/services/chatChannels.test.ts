import { describe, expect, it } from 'vitest';

import {
  buildChatChannelHandoffPayload,
  buildChatChannelOptions,
  formatChatChannelHandoffMessage,
} from './chatChannels';
import type { DefaultExtensionRuntime } from './defaultExtensions';

const slackRuntime: DefaultExtensionRuntime = {
  extensions: [{
    marketplace: {
      id: 'agent-harness.ext.external-channels',
      name: 'External chat channels',
      version: '0.1.0',
      description: 'Adds external chat channels.',
      manifest: './channel/external-channels/agent-harness.plugin.json',
      source: { type: 'local', path: './channel/external-channels' },
      categories: ['channel-extension'],
    },
    manifest: {
      schemaVersion: 1,
      id: 'agent-harness.ext.external-channels',
      name: 'External chat channels',
      version: '0.1.0',
      description: 'Adds Slack chat session handoffs.',
      entrypoint: { module: './src/index.ts', export: 'createExternalChannelsPlugin' },
      contributes: {
        channels: [{
          id: 'slack',
          label: 'Slack',
          kind: 'slack',
          capabilities: ['delegate', 'continue', 'notify'],
          description: 'Send a chat handoff to a Slack bot.',
          configuration: { type: 'object' },
        }],
      },
      capabilities: [{ kind: 'channel', id: 'slack' }],
    },
  }],
  installedExtensionIds: ['agent-harness.ext.external-channels'],
  plugins: [],
  hooks: [],
  tools: [],
  commands: [],
  renderers: [],
};

describe('chat channel share options', () => {
  it('always exposes the built-in WebRTC peer channel first', () => {
    const options = buildChatChannelOptions(null);

    expect(options).toEqual([expect.objectContaining({
      id: 'builtin.webrtc',
      label: 'WebRTC peer',
      kind: 'webrtc',
      builtIn: true,
      capabilities: ['delegate', 'continue', 'presence'],
    })]);
  });

  it('adds installed channel extension contributions after WebRTC', () => {
    const options = buildChatChannelOptions(slackRuntime);

    expect(options.map((option) => option.label)).toEqual(['WebRTC peer', 'Slack']);
    expect(options[1]).toMatchObject({
      id: 'agent-harness.ext.external-channels:slack',
      extensionId: 'agent-harness.ext.external-channels',
      kind: 'slack',
      capabilities: ['delegate', 'continue', 'notify'],
      description: 'Send a chat handoff to a Slack bot.',
    });
  });

  it('formats channel handoff payloads for external transports', () => {
    const slack = buildChatChannelOptions(slackRuntime)[1];
    const payload = buildChatChannelHandoffPayload(slack, {
      sessionId: 'session-1',
      workspaceName: 'Research',
      issuedAt: '2026-05-11T14:00:00.000Z',
    });

    expect(payload).toEqual({
      type: 'agent-harness.chat-channel-handoff',
      version: 1,
      channel: {
        id: 'agent-harness.ext.external-channels:slack',
        label: 'Slack',
        kind: 'slack',
        extensionId: 'agent-harness.ext.external-channels',
      },
      session: {
        id: 'session-1',
        workspaceName: 'Research',
      },
      capabilities: ['delegate', 'continue', 'notify'],
      issuedAt: '2026-05-11T14:00:00.000Z',
    });
    expect(formatChatChannelHandoffMessage(payload)).toContain('"type": "agent-harness.chat-channel-handoff"');
    expect(formatChatChannelHandoffMessage(payload)).toContain('Continue Agent Browser chat session "session-1"');
  });
});
