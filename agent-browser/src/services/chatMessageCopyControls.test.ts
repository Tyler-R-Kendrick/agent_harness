import { afterEach, describe, expect, it, vi } from 'vitest';
import { installChatMessageCopyControls } from './chatMessageCopyControls';

describe('installChatMessageCopyControls', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('adds markdown and plaintext copy controls to chat messages', () => {
    const host = renderMessage();
    const disconnect = installChatMessageCopyControls({ root: host, clipboard: { writeText: vi.fn() } });

    expect(host.querySelector('[aria-label="Copy codi message as markdown"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Copy codi message as plaintext"]')).not.toBeNull();

    disconnect();
  });

  it('writes serialized markdown and notifies clipboard listeners', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const host = renderMessage();
    const copyListener = vi.fn((event: Event) => {
      const clipboardData = (event as ClipboardEvent).clipboardData;
      expect(clipboardData?.getData('text/plain')).toContain('**bold**');
    });
    document.addEventListener('copy', copyListener);
    const disconnect = installChatMessageCopyControls({ root: host, clipboard: { writeText } });

    (host.querySelector('[aria-label="Copy codi message as markdown"]') as HTMLButtonElement).click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('Use **bold** and `code`.');
    expect(copyListener).toHaveBeenCalledOnce();
    disconnect();
    document.removeEventListener('copy', copyListener);
  });

  it('writes serialized plaintext without duplicating controls on repeated install scans', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const host = renderMessage();
    const disconnect = installChatMessageCopyControls({ root: host, clipboard: { writeText } });

    installChatMessageCopyControls({ root: host, clipboard: { writeText } })();
    expect(host.querySelectorAll('.message-action-button')).toHaveLength(2);

    (host.querySelector('[aria-label="Copy codi message as plaintext"]') as HTMLButtonElement).click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('Use bold and code.');
    disconnect();
  });

  it('ignores messages without a sender, bubble, or clipboard writer', () => {
    const host = document.createElement('div');
    host.innerHTML = '<article class="message"><div class="message-sender"></div></article>';
    document.body.append(host);

    const disconnect = installChatMessageCopyControls({ root: host, clipboard: undefined });

    expect(host.querySelector('.message-action-button')).toBeNull();
    disconnect();
  });
});

function renderMessage() {
  const host = document.createElement('div');
  host.innerHTML = `
    <article class="message assistant">
      <div class="message-sender">
        <span class="sender-name">codi</span>
      </div>
      <div class="message-bubble">
        <p>Use <strong>bold</strong> and <code>code</code>.</p>
      </div>
    </article>
  `;
  document.body.append(host);
  return host;
}
