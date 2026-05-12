import { describe, expect, it } from 'vitest';
import { createHarnessExtensionContext } from 'harness-core';
import {
  MARKDOWN_PREVIEW_FILE_EXTENSIONS,
  MARKDOWN_PREVIEW_MIME_TYPES,
  MARKDOWN_PREVIEW_RENDERER,
  MarkdownPreviewRenderer,
  createMarkdownPreviewPlugin,
} from './index';

describe('markdown preview extension', () => {
  it('declares markdown and mdx file bindings for the renderer', () => {
    expect(MARKDOWN_PREVIEW_RENDERER).toMatchObject({
      id: 'markdown-preview.renderer',
      target: {
        kind: 'file',
        fileExtensions: ['.md', '.mdx', '.markdown', '.mdown', '.mkd'],
        mimeTypes: ['text/markdown', 'text/mdx'],
      },
      implementations: [
        expect.objectContaining({
          id: 'markdown-preview.react',
          runtime: 'react',
        }),
      ],
      priority: 20,
    });
    expect(MARKDOWN_PREVIEW_FILE_EXTENSIONS).toContain('.mdx');
    expect(MARKDOWN_PREVIEW_MIME_TYPES).toContain('text/markdown');
    expect(MarkdownPreviewRenderer()).toBeNull();
  });

  it('registers the renderer through the extension context', async () => {
    const context = createHarnessExtensionContext();

    await context.plugins.load(createMarkdownPreviewPlugin());

    expect(context.renderers.findForTarget({
      kind: 'file',
      path: 'artifacts/checklist.md',
      mimeType: 'text/markdown',
    }).map((renderer) => renderer.id)).toEqual(['markdown-preview.renderer']);
    expect(context.renderers.findForTarget({
      kind: 'file',
      path: 'notes/story.mdx',
      mimeType: 'text/mdx',
    }).map((renderer) => renderer.id)).toEqual(['markdown-preview.renderer']);
  });
});
