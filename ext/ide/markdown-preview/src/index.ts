import type { HarnessPlugin, HarnessRendererDefinition } from 'harness-core';

export const MARKDOWN_PREVIEW_RENDERER_ID = 'markdown-preview.renderer';
export const MARKDOWN_PREVIEW_FILE_EXTENSIONS = ['.md', '.mdx', '.markdown', '.mdown', '.mkd'] as const;
export const MARKDOWN_PREVIEW_MIME_TYPES = ['text/markdown', 'text/mdx'] as const;

export const MARKDOWN_PREVIEW_RENDERER: HarnessRendererDefinition = {
  id: MARKDOWN_PREVIEW_RENDERER_ID,
  label: 'Markdown preview',
  description: 'Renders Markdown and MDX files as sanitized HTML preview content.',
  target: {
    kind: 'file',
    fileExtensions: MARKDOWN_PREVIEW_FILE_EXTENSIONS,
    mimeTypes: MARKDOWN_PREVIEW_MIME_TYPES,
  },
  implementations: [{
    id: 'markdown-preview.react',
    label: 'React markdown preview',
    runtime: 'react',
    component: {
      module: './src/index.ts',
      export: 'MarkdownPreviewRenderer',
    },
  }],
  priority: 20,
};

export function createMarkdownPreviewPlugin(): HarnessPlugin {
  return {
    id: 'markdown-preview',
    register({ renderers }) {
      renderers.register(MARKDOWN_PREVIEW_RENDERER);
    },
  };
}

export function MarkdownPreviewRenderer(): null {
  return null;
}
