export type ClipboardCopyFormat = 'markdown' | 'plaintext';

export function formatMessageCopyContent(content: string, format: ClipboardCopyFormat): string {
  if (format === 'markdown') return content;
  return markdownToPlaintext(content);
}

export function createMessageCopyLabel(senderLabel: string, format: ClipboardCopyFormat): string {
  return `Chat ${senderLabel} message (${format})`;
}

export function messageElementToCopyContent(message: Element, format: ClipboardCopyFormat): string {
  const bubble = message.querySelector('.message-bubble');
  if (!bubble) return '';

  if (format === 'plaintext') {
    return normalizePlaintext(bubble.textContent ?? '');
  }

  return normalizeMarkdown(elementToMarkdown(bubble));
}

function markdownToPlaintext(content: string): string {
  return normalizePlaintext(content
    .replace(/\r\n?/g, '\n')
    .replace(/```[\w-]*\n([\s\S]*?)```/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]{0,3}>[ \t]?/gm, '')
    .replace(/^[ \t]*[-*+][ \t]+/gm, '')
    .replace(/^[ \t]*\d+\.[ \t]+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1'));
}

function normalizePlaintext(content: string): string {
  return content
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeMarkdown(content: string): string {
  return content
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function elementToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return normalizeTextNode(node.textContent ?? '');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();
  const childMarkdown = () => Array.from(element.childNodes).map(elementToMarkdown).join('');

  switch (tagName) {
    case 'br':
      return '\n';
    case 'strong':
    case 'b':
      return `**${childMarkdown()}**`;
    case 'em':
    case 'i':
      return `*${childMarkdown()}*`;
    case 'code':
      if (element.parentElement?.tagName.toLowerCase() === 'pre') return childMarkdown();
      return `\`${childMarkdown()}\``;
    case 'pre':
      return `\n\n\`\`\`\n${childMarkdown().trimEnd()}\n\`\`\`\n\n`;
    case 'a': {
      const href = element.getAttribute('href');
      const text = childMarkdown();
      return href ? `[${text}](${href})` : text;
    }
    case 'li':
      return `- ${childMarkdown().trim()}\n`;
    case 'ul':
    case 'ol':
      return `\n${childMarkdown()}\n`;
    case 'blockquote':
      return childMarkdown()
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n');
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return `\n${'#'.repeat(Number(tagName.slice(1)))} ${childMarkdown().trim()}\n\n`;
    case 'p':
    case 'div':
      return `${childMarkdown()}\n\n`;
    default:
      return childMarkdown();
  }
}

function normalizeTextNode(content: string): string {
  if (!content.trim()) return '';
  if (!content.includes('\n')) return content;
  return content.replace(/\s+/g, ' ').trimStart();
}
