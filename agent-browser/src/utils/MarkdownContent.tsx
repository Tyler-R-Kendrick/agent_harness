import { useEffect, useMemo, useRef } from 'react';
import { marked, Renderer as MarkedRenderer, type Tokens } from 'marked';
import DOMPurify from 'dompurify';

const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export interface MarkdownContentProps {
  content: string;
  className?: string;
  enableMermaid?: boolean;
}

interface RenderedMarkdown {
  html: string;
  mermaidDiagrams: string[];
}

type MermaidApi = typeof import('mermaid').default;
type MermaidModule = { default: MermaidApi };
type MermaidImporter = () => Promise<MermaidModule>;

let mermaidInitialized = false;
let mermaidRenderSequence = 0;

function importMermaidModule(): Promise<MermaidModule> {
  return import('mermaid');
}

let mermaidImporter: MermaidImporter = importMermaidModule;

export function setMermaidImporterForTest(importer?: MermaidImporter): void {
  mermaidImporter = importer ?? importMermaidModule;
  mermaidInitialized = false;
  mermaidRenderSequence = 0;
}

function createMarkdownRenderer(mermaidDiagrams: string[] | null): MarkedRenderer {
  const renderer = new MarkedRenderer();
  renderer.link = ({ href, title, text }: Tokens.Link) => {
    const safe = sanitizeLinkHref(href);
    const titleAttr = title ? ` title="${sanitizeHtmlAttribute(title)}"` : '';
    return `<a href="${safe}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
  };

  if (mermaidDiagrams) {
    const defaultCodeRenderer = renderer.code.bind(renderer);
    renderer.code = (token: Tokens.Code) => {
      if (isMermaidLanguage(token.lang)) {
        const index = mermaidDiagrams.push(token.text.trimEnd()) - 1;
        return [
          `<figure class="markdown-mermaid" data-mermaid-index="${index}">`,
          '<div class="markdown-mermaid-output" role="img" aria-label="Mermaid diagram">Rendering Mermaid diagram</div>',
          '<details class="markdown-mermaid-source">',
          '<summary>Diagram source</summary>',
          `<pre><code class="language-mermaid">${sanitizeHtmlText(token.text.trimEnd())}</code></pre>`,
          '</details>',
          '</figure>',
        ].join('');
      }
      return defaultCodeRenderer(token);
    };
  }

  return renderer;
}

function renderMarkdown(content: string, enableMermaid: boolean): RenderedMarkdown {
  const mermaidDiagrams = enableMermaid ? [] : null;
  const html = marked.parse(content, {
    renderer: createMarkdownRenderer(mermaidDiagrams),
    gfm: true,
    breaks: false,
  }) as string;

  return {
    html: DOMPurify.sanitize(html, {
      ADD_ATTR: ['target', 'rel', 'data-mermaid-index', 'aria-label', 'role'],
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
      FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
    }),
    mermaidDiagrams: mermaidDiagrams ?? [],
  };
}

function isMermaidLanguage(value: string | undefined): boolean {
  return value?.trim().split(/\s+/)[0]?.toLowerCase() === 'mermaid';
}

function sanitizeHtmlAttribute(value: string): string {
  return DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeLinkHref(value: string): string {
  const trimmed = value.trim();
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

async function loadMermaid(): Promise<MermaidApi> {
  const mermaid = (await mermaidImporter()).default;
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      flowchart: { htmlLabels: false },
    });
    mermaidInitialized = true;
  }
  return mermaid;
}

function sanitizeMermaidSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_ATTR: ['aria-label', 'focusable', 'role', 'viewBox'],
    FORBID_TAGS: ['script', 'foreignObject'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
  });
}

async function hydrateMermaidDiagrams(
  container: HTMLElement,
  diagrams: readonly string[],
): Promise<void> {
  let mermaidApi: MermaidApi;
  try {
    mermaidApi = await loadMermaid();
  } catch (error) {
    for (const output of container.querySelectorAll<HTMLElement>('.markdown-mermaid-output')) {
      output.textContent = `Unable to load Mermaid renderer: ${error instanceof Error ? error.message : String(error)}`;
      output.dataset.state = 'error';
    }
    return;
  }

  await Promise.all(diagrams.map(async (diagram, index) => {
    const output = container.querySelector<HTMLElement>(`.markdown-mermaid[data-mermaid-index="${index}"] .markdown-mermaid-output`)!;
    try {
      const result = await mermaidApi.render(`markdown-mermaid-${Date.now()}-${mermaidRenderSequence++}`, diagram);
      output.innerHTML = sanitizeMermaidSvg(result.svg);
      output.dataset.state = 'rendered';
    } catch (error) {
      output.textContent = `Unable to render Mermaid diagram: ${error instanceof Error ? error.message : String(error)}`;
      output.dataset.state = 'error';
    }
  }));
}

export function MarkdownContent({ content, className, enableMermaid = false }: MarkdownContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendered = useMemo(() => renderMarkdown(content, enableMermaid), [content, enableMermaid]);

  useEffect(() => {
    if (!enableMermaid || rendered.mermaidDiagrams.length === 0 || !containerRef.current) return undefined;
    void hydrateMermaidDiagrams(containerRef.current, rendered.mermaidDiagrams);
    return undefined;
  }, [enableMermaid, rendered]);

  // eslint-disable-next-line react/no-danger
  return <div ref={containerRef} className={className} dangerouslySetInnerHTML={{ __html: rendered.html }} />;
}
