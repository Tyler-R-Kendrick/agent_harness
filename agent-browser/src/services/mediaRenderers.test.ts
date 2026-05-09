import { describe, expect, it } from 'vitest';

import type { HarnessRendererDefinition } from 'harness-core';

import {
  BOUNDED_CHAT_RENDERER_ID,
  DEFAULT_NATIVE_MEDIA_RENDERERS,
  RAW_RENDERER_ID,
  resolveArtifactFileRenderer,
} from './mediaRenderers';
import type { ArtifactFile } from './artifacts';

describe('mediaRenderers', () => {
  const pluginRenderer: HarnessRendererDefinition = {
    id: 'workflow-canvas.media-renderer',
    label: 'Workflow canvas',
    target: {
      kind: 'file',
      mimeTypes: ['application/vnd.agent-harness.workflow-canvas+json'],
    },
    implementations: [{
      id: 'workflow-canvas.wasi',
      label: 'WASI renderer',
      runtime: 'wasi-preview2',
      module: './dist/workflow-canvas-renderer.wasm',
      wasi: {
        world: 'agent-harness:media-renderer/render@0.1.0',
        wit: './wit/media-renderer.wit',
      },
    }, {
      id: 'workflow-canvas.react',
      label: 'React renderer',
      runtime: 'react',
      component: {
        module: './src/WorkflowCanvasRenderer.tsx',
        export: 'WorkflowCanvasRenderer',
      },
    }],
  };

  it('declares default native browser renderers for media families the browser can render', () => {
    expect(DEFAULT_NATIVE_MEDIA_RENDERERS.map((renderer) => renderer.id)).toEqual([
      'agent-browser.native.html',
      'agent-browser.native.svg',
      'agent-browser.native.image',
      'agent-browser.native.audio',
      'agent-browser.native.video',
      'agent-browser.native.pdf',
      'agent-browser.native.text',
    ]);
    expect(DEFAULT_NATIVE_MEDIA_RENDERERS.flatMap((renderer) => renderer.target.mimeTypes ?? [])).toEqual([
      'text/html',
      'image/svg+xml',
      'image/*',
      'audio/*',
      'video/*',
      'application/pdf',
      'text/*',
      'application/json',
    ]);
  });

  it('selects installed plugin renderers before native browser defaults', () => {
    const file: ArtifactFile = {
      path: 'launch.workflow.json',
      mediaType: 'application/vnd.agent-harness.workflow-canvas+json',
      content: '{"nodes":[]}',
    };

    const binding = resolveArtifactFileRenderer(file, { extensionRenderers: [pluginRenderer] });

    expect(binding).toEqual(expect.objectContaining({
      kind: 'plugin',
      rendererId: 'workflow-canvas.media-renderer',
      implementationId: 'workflow-canvas.wasi',
      implementationRuntime: 'wasi-preview2',
      rawAvailable: true,
    }));
  });

  it('falls back to bounded chat with an optional raw view for unsupported media', () => {
    const file: ArtifactFile = {
      path: 'model.weights',
      mediaType: 'application/octet-stream',
      content: 'raw bytes placeholder',
    };

    const binding = resolveArtifactFileRenderer(file, { extensionRenderers: [] });

    expect(binding).toEqual({
      kind: 'bounded-chat',
      rendererId: BOUNDED_CHAT_RENDERER_ID,
      label: 'Chat session',
      rawRendererId: RAW_RENDERER_ID,
      rawAvailable: true,
      reason: 'No installed or native renderer is bound to application/octet-stream.',
    });
  });
});
