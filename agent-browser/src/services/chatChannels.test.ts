import { describe, expect, it } from 'vitest';

import {
  buildChatChannelHandoffPayload,
  buildChatChannelOptions,
  formatChatChannelHandoffMessage,
} from './chatChannels';
import { createDefaultExtensionRuntime, type DefaultExtensionRuntime } from './defaultExtensions';

const slackRuntime: DefaultExtensionRuntime = {
  extensions: [{
    marketplace: {
      id: 'agent-harness.ext.slack-channel',
      name: 'Slack chat channel',
      version: '0.1.0',
      description: 'Adds Slack chat handoffs.',
      manifest: './channel/slack/agent-harness.plugin.json',
      source: { type: 'local', path: './channel/slack' },
      categories: ['channel-extension', 'slack'],
    },
    manifest: {
      schemaVersion: 1,
      id: 'agent-harness.ext.slack-channel',
      name: 'Slack chat channel',
      version: '0.1.0',
      description: 'Adds Slack chat session handoffs.',
      entrypoint: { module: './src/index.ts', export: 'createSlackChannelPlugin' },
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
  installedExtensionIds: ['agent-harness.ext.slack-channel'],
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
      id: 'agent-harness.ext.slack-channel:slack',
      extensionId: 'agent-harness.ext.slack-channel',
      kind: 'slack',
      capabilities: ['delegate', 'continue', 'notify'],
      description: 'Send a chat handoff to a Slack bot.',
    });
  });

  it('keeps Slack, Telegram, and SMS independently installable', async () => {
    const runtime = await createDefaultExtensionRuntime([], {
      installedExtensionIds: [
        'agent-harness.ext.slack-channel',
        'agent-harness.ext.sms-channel',
      ],
    });

    const options = buildChatChannelOptions(runtime);

    expect(options.map((option) => option.label)).toEqual(['WebRTC peer', 'Slack', 'SMS']);
    expect(options.map((option) => option.extensionId).filter(Boolean)).toEqual([
      'agent-harness.ext.slack-channel',
      'agent-harness.ext.sms-channel',
    ]);
    expect(options.some((option) => option.kind === 'telegram')).toBe(false);
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
        id: 'agent-harness.ext.slack-channel:slack',
        label: 'Slack',
        kind: 'slack',
        extensionId: 'agent-harness.ext.slack-channel',
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
