import {
  type ClipboardCopyFormat,
  messageElementToCopyContent,
} from './chatMessageCopy';

type InstallOptions = {
  root?: ParentNode;
  clipboard?: Pick<Clipboard, 'writeText'>;
};

export function installChatMessageCopyControls(options: InstallOptions = {}): () => void {
  const root = options.root ?? document;
  const clipboard = options.clipboard ?? navigator.clipboard;

  const enhance = () => {
    root.querySelectorAll('.message').forEach((message) => enhanceMessage(message, clipboard));
  };

  enhance();

  const observer = new MutationObserver(enhance);
  const target = root instanceof Document ? root.body : root;
  observer.observe(target, { childList: true, subtree: true });

  return () => observer.disconnect();
}

function enhanceMessage(message: Element, clipboard: Pick<Clipboard, 'writeText'> | undefined) {
  if (!clipboard?.writeText) return;
  if (message.hasAttribute('data-chat-copy-enhanced')) return;

  const sender = message.querySelector('.sender-name');
  const senderLabel = sender?.textContent?.trim();
  const header = message.querySelector('.message-sender');
  if (!header || !senderLabel || !message.querySelector('.message-bubble')) return;

  message.setAttribute('data-chat-copy-enhanced', 'true');

  const actions = document.createElement('span');
  actions.className = 'message-actions chat-copy-actions';
  actions.setAttribute('aria-label', `${senderLabel} message actions`);
  actions.append(
    createCopyButton('markdown', senderLabel, message, clipboard),
    createCopyButton('plaintext', senderLabel, message, clipboard),
  );
  header.append(actions);
}

function createCopyButton(
  format: ClipboardCopyFormat,
  senderLabel: string,
  message: Element,
  clipboard: Pick<Clipboard, 'writeText'>,
) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `message-action-button chat-copy-${format}`;
  button.setAttribute('aria-label', `Copy ${senderLabel} message as ${format}`);
  button.title = `Copy as ${format}`;
  button.textContent = format === 'markdown' ? 'MD' : 'Tx';
  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const text = messageElementToCopyContent(message, format);
    if (!text) return;
    await clipboard.writeText(text);
    dispatchCopyEvent(text);
    button.setAttribute('data-copied', 'true');
    window.setTimeout(() => button.removeAttribute('data-copied'), 900);
  });
  return button;
}

function dispatchCopyEvent(text: string) {
  const event = new Event('copy', { bubbles: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: (format: string) => (format === 'text/plain' ? text : '') },
  });
  document.dispatchEvent(event);
}
