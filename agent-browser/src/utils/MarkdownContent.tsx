import { useMemo } from 'react';
import { marked, type Renderer } from 'marked';
import DOMPurify from 'dompurify';

const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

const renderer: Partial<Renderer> = {
  link({ href, title, text }) {
    const safe = sanitizeLinkHref(href);
    const titleAttr = title ? ` title="${sanitizeHtmlAttribute(title)}"` : '';
    return `<a href="${safe}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
  },
};

marked.use({ renderer, gfm: true, breaks: false });

function renderMarkdown(content: string): string {
  const html = marked.parse(content) as string;
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'rel'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
  });
}

function sanitizeHtmlAttribute(value: string): string {
  return DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeLinkHref(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    return '#';
  }

  if (
    trimmed.startsWith('#')
    || trimmed.startsWith('/')
    || trimmed.startsWith('./')
    || trimmed.startsWith('../')
    || trimmed.startsWith('?')
  ) {
    return sanitizeHtmlAttribute(trimmed);
  }

  try {
    const parsed = new URL(trimmed);
    if (SAFE_LINK_PROTOCOLS.has(parsed.protocol)) {
      return sanitizeHtmlAttribute(trimmed);
    }
  } catch {
    // Fall through to the inert placeholder for malformed URLs.
  }

  return '#';
}

export function MarkdownContent({ content, className }: { content: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(content), [content]);
  // eslint-disable-next-line react/no-danger
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
