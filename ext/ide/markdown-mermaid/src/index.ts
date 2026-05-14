import type { HarnessPlugin, HarnessRendererDefinition } from 'harness-core';

export const MARKDOWN_MERMAID_RENDERER_ID = 'markdown-mermaid.renderer';
export const MARKDOWN_MERMAID_FILE_EXTENSIONS = ['.md', '.mdx', '.markdown', '.mdown', '.mkd'] as const;
export const MARKDOWN_MERMAID_MIME_TYPES = ['text/markdown', 'text/mdx'] as const;

export const MARKDOWN_MERMAID_RENDERER: HarnessRendererDefinition = {
  id: MARKDOWN_MERMAID_RENDERER_ID,
  label: 'Markdown Mermaid preview',
  description: 'Renders Markdown and MDX files with sanitized Mermaid diagram support.',
  target: {
    kind: 'file',
    fileExtensions: MARKDOWN_MERMAID_FILE_EXTENSIONS,
    mimeTypes: MARKDOWN_MERMAID_MIME_TYPES,
  },
  implementations: [{
    id: 'markdown-mermaid.react',
    label: 'React Mermaid markdown preview',
    runtime: 'react',
    component: {
      module: './src/index.ts',
      export: 'MermaidMarkdownRenderer',
    },
  }],
  priority: 30,
};

export function createMarkdownMermaidPlugin(): HarnessPlugin {
  return {
    id: 'markdown-mermaid',
    register({ renderers }) {
      renderers.register(MARKDOWN_MERMAID_RENDERER);
    },
  };
}

export function MermaidMarkdownRenderer(): null {
  return null;
}
