import { describe, expect, it } from 'vitest';
import { createMessageCopyLabel, formatMessageCopyContent, messageElementToCopyContent } from './chatMessageCopy';

describe('formatMessageCopyContent', () => {
  it('returns markdown content unchanged for markdown copy', () => {
    const source = '## Result\n\nUse **bold** and [docs](https://example.test).';

    expect(formatMessageCopyContent(source, 'markdown')).toBe(source);
  });

  it('converts markdown links, emphasis, code, and list markers into readable plaintext', () => {
    const source = '## Result\n\n- Use **bold** and `code`\n- Read [docs](https://example.test)';

    expect(formatMessageCopyContent(source, 'plaintext')).toBe('Result\n\nUse bold and code\nRead docs (https://example.test)');
  });

  it('normalizes excessive blank lines and trims copied plaintext', () => {
    const source = '\n\nFirst paragraph\n\n\n\n> quoted text\n\n';

    expect(formatMessageCopyContent(source, 'plaintext')).toBe('First paragraph\n\nquoted text');
  });
});

describe('createMessageCopyLabel', () => {
  it('includes sender and format for clipboard history', () => {
    expect(createMessageCopyLabel('codi', 'markdown')).toBe('Chat codi message (markdown)');
    expect(createMessageCopyLabel('you', 'plaintext')).toBe('Chat you message (plaintext)');
  });
});

describe('messageElementToCopyContent', () => {
  it('serializes rendered message markup back to markdown', () => {
    const message = document.createElement('article');
    message.innerHTML = `
      <div class="message-bubble">
        <h2>Result</h2>
        <p>Use <strong>bold</strong>, <code>code</code>, and <a href="https://example.test">docs</a>.</p>
        <ul><li>First</li><li>Second</li></ul>
      </div>
    `;

    expect(messageElementToCopyContent(message, 'markdown')).toBe(
      '## Result\n\nUse **bold**, `code`, and [docs](https://example.test).\n\n- First\n- Second',
    );
  });

  it('preserves ordered list numbering when serializing rendered markup to markdown', () => {
    const message = document.createElement('article');
    message.innerHTML = `
      <div class="message-bubble">
        <p>Follow these steps:</p>
        <ol><li>Open settings</li><li>Enable the tool</li></ol>
      </div>
    `;

    expect(messageElementToCopyContent(message, 'markdown')).toBe(
      'Follow these steps:\n\n1. Open settings\n2. Enable the tool',
    );
  });

  it('serializes rendered message markup to compact plaintext', () => {
    const message = document.createElement('article');
    message.innerHTML = `
      <div class="message-bubble">
        <p>Use <strong>bold</strong></p>
        <p>Then code</p>
      </div>
    `;

    expect(messageElementToCopyContent(message, 'plaintext')).toBe('Use bold\nThen code');
  });

  it('returns an empty string when a message has no bubble', () => {
    expect(messageElementToCopyContent(document.createElement('article'), 'markdown')).toBe('');
  });
});
