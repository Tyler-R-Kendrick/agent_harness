import { useMemo } from 'react';
import { marked, type Renderer } from 'marked';
import DOMPurify from 'dompurify';

const renderer: Partial<Renderer> = {
  link({ href, title, text }) {
    const safe = DOMPurify.sanitize(href ?? '', { ALLOWED_TAGS: [] });
    const titleAttr = title ? ` title="${title}"` : '';
    return `<a href="${safe}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
  },
};

marked.use({ renderer, gfm: true, breaks: false });

function renderMarkdown(content: string): string {
  const html = marked.parse(content) as string;
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
  });
}

export function MarkdownContent({ content, className }: { content: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(content), [content]);
  // eslint-disable-next-line react/no-danger
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
