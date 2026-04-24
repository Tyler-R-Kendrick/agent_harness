import { useMemo } from 'react';
import { marked, type Renderer } from 'marked';
import DOMPurify from 'dompurify';

const renderer: Partial<Renderer> = {
  link({ href, title, text }) {
    const safe = sanitizeHtmlAttribute(href);
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

export function MarkdownContent({ content, className }: { content: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(content), [content]);
  // eslint-disable-next-line react/no-danger
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
