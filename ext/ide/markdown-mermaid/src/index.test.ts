import { describe, expect, it } from 'vitest';
import { createHarnessExtensionContext } from 'harness-core';
import {
  MARKDOWN_MERMAID_FILE_EXTENSIONS,
  MARKDOWN_MERMAID_MIME_TYPES,
  MARKDOWN_MERMAID_RENDERER,
  MermaidMarkdownRenderer,
  createMarkdownMermaidPlugin,
} from './index';

describe('markdown Mermaid extension', () => {
  it('declares markdown and mdx file bindings for the Mermaid renderer', () => {
    expect(MARKDOWN_MERMAID_RENDERER).toMatchObject({
      id: 'markdown-mermaid.renderer',
      target: {
        kind: 'file',
        fileExtensions: ['.md', '.mdx', '.markdown', '.mdown', '.mkd'],
        mimeTypes: ['text/markdown', 'text/mdx'],
      },
      implementations: [
        expect.objectContaining({
          id: 'markdown-mermaid.react',
          runtime: 'react',
        }),
      ],
      priority: 30,
    });
    expect(MARKDOWN_MERMAID_FILE_EXTENSIONS).toContain('.mdx');
    expect(MARKDOWN_MERMAID_MIME_TYPES).toContain('text/markdown');
    expect(MermaidMarkdownRenderer()).toBeNull();
  });

  it('registers above the base Markdown renderer through the extension context', async () => {
    const context = createHarnessExtensionContext();

    context.renderers.register({
      id: 'markdown-preview.renderer',
      label: 'Markdown preview',
      target: {
        kind: 'file',
        fileExtensions: ['.md'],
        mimeTypes: ['text/markdown'],
      },
      implementations: [{
        id: 'markdown-preview.react',
        runtime: 'react',
        component: { module: './src/index.ts', export: 'MarkdownPreviewRenderer' },
      }],
      priority: 20,
    });
    await context.plugins.load(createMarkdownMermaidPlugin());

    expect(context.renderers.findForTarget({
      kind: 'file',
      path: 'artifacts/architecture.md',
      mimeType: 'text/markdown',
    }).map((renderer) => renderer.id)).toEqual([
      'markdown-mermaid.renderer',
      'markdown-preview.renderer',
    ]);
    expect(context.renderers.findForTarget({
      kind: 'file',
      path: 'notes/story.mdx',
      mimeType: 'text/mdx',
    }).map((renderer) => renderer.id)).toEqual(['markdown-mermaid.renderer']);
  });
});
