import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_WEBRTC_CHAT_CHANNEL, type ChatChannelOption } from '../services/chatChannels';
import { SharedChatModal } from './SharedChatModal';

const slackChannel: ChatChannelOption = {
  id: 'agent-harness.ext.slack-channel:slack',
  label: 'Slack',
  kind: 'slack',
  capabilities: ['delegate', 'continue', 'notify', 'handoff-link'],
  description: 'Send a chat handoff to a Slack bot.',
  extensionId: 'agent-harness.ext.slack-channel',
};

const smsChannel: ChatChannelOption = {
  id: 'agent-harness.ext.sms-channel:sms',
  label: 'SMS',
  kind: 'sms',
  capabilities: ['delegate', 'continue', 'notify', 'handoff-link'],
  description: 'Send a chat handoff to an SMS gateway.',
  extensionId: 'agent-harness.ext.sms-channel',
};

function renderModal(overrides: Partial<Parameters<typeof SharedChatModal>[0]> = {}) {
  const onCopyToClipboard = vi.fn().mockResolvedValue(undefined);
  const props: Parameters<typeof SharedChatModal>[0] = {
    open: true,
    sessionId: 'session-1',
    workspaceName: 'Research',
    channelOptions: [DEFAULT_WEBRTC_CHAT_CHANNEL, slackChannel, smsChannel],
    onClose: vi.fn(),
    onApiChange: vi.fn(),
    onRemoteMessage: vi.fn(),
    onStatusMessage: vi.fn(),
    onToast: vi.fn(),
    onCopyToClipboard,
    ...overrides,
  };
  render(<SharedChatModal {...props} />);
  return props;
}

describe('SharedChatModal channel options', () => {
  it('keeps WebRTC pairing visible while listing extension channels', () => {
    renderModal();

    expect(screen.getByRole('button', { name: /Start shared session/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Join shared session/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Channel share options')).toHaveTextContent('WebRTC peer');
    expect(screen.getByLabelText('Channel share options')).toHaveTextContent('Slack');
    expect(screen.getByLabelText('Channel share options')).toHaveTextContent('SMS');
  });

  it('copies a structured handoff message for external channels', async () => {
    const props = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Share with Slack' }));

    await waitFor(() => expect(props.onCopyToClipboard).toHaveBeenCalledTimes(1));
    const [message, label] = vi.mocked(props.onCopyToClipboard).mock.calls[0];
    expect(label).toBe('Slack channel handoff');
    expect(message).toContain('"type": "agent-harness.chat-channel-handoff"');
    expect(message).toContain('"kind": "slack"');
    expect(message).toContain('Continue Agent Browser chat session "session-1"');
    expect(props.onStatusMessage).toHaveBeenCalledWith('Slack handoff copied. Send it through the configured channel extension to delegate or continue this chat.');
    expect(props.onToast).toHaveBeenCalledWith('Slack handoff copied', 'success');
  });
});
