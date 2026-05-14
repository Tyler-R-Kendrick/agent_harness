import { createHarnessExtensionContext } from 'harness-core';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HYPERFRAMES_CONFIG,
  HyperframesEditorPane,
  HyperframesPreviewRenderer,
  HYPERFRAMES_RENDERER,
  createHyperframesArtifact,
  createHyperframesPlugin,
  createPreviewHtml,
} from './index';

describe('HyperFrames extension', () => {
  it('defines the hyperframes artifact renderer target', () => {
    expect(HYPERFRAMES_RENDERER.target).toEqual({
      kind: 'artifact',
      artifactKinds: ['hyperframe', 'hyperframes-project'],
    });
  });

  it('creates artifact output with config and preview files', () => {
    const artifact = createHyperframesArtifact('Launch', { style: 'product', durationSeconds: 15, aspectRatio: '9:16', prompt: 'Demo' });
    const untitled = createHyperframesArtifact('   ');

    expect(artifact.kind).toBe('hyperframe');
    expect(artifact.title).toBe('Launch');
    expect(artifact.config.style).toBe('product');
    expect(artifact.files.map((file) => file.path)).toEqual(['hyperframe.config.json', 'preview.html']);
    expect(artifact.files[1]?.content).toContain('Style: product');
    expect(untitled.title).toBe('Untitled HyperFrame');
  });

  it('escapes html in title and falls back to defaults', () => {
    const artifact = createHyperframesArtifact(' <Demo> ');
    const html = createPreviewHtml(' <Demo> ', DEFAULT_HYPERFRAMES_CONFIG);
    const fallbackHtml = createPreviewHtml('   ', DEFAULT_HYPERFRAMES_CONFIG);
    const plainHtml = createPreviewHtml('Plain Demo', DEFAULT_HYPERFRAMES_CONFIG);

    expect(artifact.title).toBe('<Demo>');
    expect(html).toContain('&lt;Demo&gt;');
    expect(html).toContain(DEFAULT_HYPERFRAMES_CONFIG.prompt);
    expect(fallbackHtml).toContain('Untitled HyperFrame');
    expect(plainHtml).toContain('Plain Demo');
  });

  it('registers renderer and tool and executes generation tool', async () => {
    const plugin = createHyperframesPlugin();
    const context = createHarnessExtensionContext();
    plugin.register(context);

    expect(context.renderers.list().map((renderer) => renderer.id)).toContain('hyperframes.artifact-preview');
    const tool = context.tools.get('hyperframes.generate');
    const generated = await tool.execute({ title: 'Storyboard', style: 'editorial' });
    const defaultNamed = await tool.execute({});

    expect(generated.title).toBe('Storyboard');
    expect(generated.config.style).toBe('editorial');
    expect(defaultNamed.title).toBe('Untitled HyperFrame');
    expect(HyperframesEditorPane()).toBeNull();
    expect(HyperframesPreviewRenderer()).toBeNull();
  });
});
