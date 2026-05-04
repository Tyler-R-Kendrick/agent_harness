import { describe, expect, it } from 'vitest';

import {
  RendererRegistry,
  createHarnessExtensionContext,
  type HarnessPlugin,
} from '../index.js';

describe('renderer registry', () => {
  it('registers and lists custom renderer definitions in priority order', () => {
    const registry = new RendererRegistry();

    registry.register({
      id: 'pdf.viewer',
      label: 'PDF viewer',
      target: {
        kind: 'file',
        fileExtensions: ['.pdf'],
        mimeTypes: ['application/pdf'],
      },
      component: {
        module: './renderers/PdfRenderer.tsx',
        export: 'PdfRenderer',
      },
      priority: 10,
    });
    registry.register({
      id: 'pdf.fallback',
      label: 'PDF fallback',
      target: {
        kind: 'file',
        fileExtensions: ['pdf'],
      },
      component: {
        module: './renderers/FallbackPdfRenderer.tsx',
      },
    });

    expect(registry.get('pdf.viewer')?.label).toBe('PDF viewer');
    expect(registry.list().map((renderer) => renderer.id)).toEqual(['pdf.viewer', 'pdf.fallback']);
    expect(registry.findForTarget({
      kind: 'file',
      path: 'docs/report.PDF',
      mimeType: 'application/pdf',
    }).map((renderer) => renderer.id)).toEqual(['pdf.viewer', 'pdf.fallback']);
    expect(registry.findForTarget({ kind: 'file' })).toEqual([]);
  });

  it('matches wildcard MIME renderers and DESIGN.md pane items', () => {
    const registry = new RendererRegistry();

    registry.register({
      id: 'audio.visualizer',
      label: 'Audio visualizer',
      target: {
        kind: 'file',
        mimeTypes: ['audio/*'],
      },
      component: {
        module: './renderers/AudioVisualizer.tsx',
      },
    });
    registry.registerPaneItem({
      id: 'design-md.designer',
      label: 'Designer',
      rendererId: 'design-md.renderer',
      preferredLocation: 'side',
      when: {
        kind: 'file',
        fileNames: ['DESIGN.md'],
      },
      component: {
        module: './panes/DesignerPane.tsx',
        export: 'DesignerPane',
      },
    });
    registry.register({
      id: 'log.message',
      label: 'Log message',
      target: {
        kind: 'message',
        messageTypes: ['log'],
      },
      component: {
        module: './renderers/LogMessage.tsx',
      },
      paneItem: {
        id: 'log.message.details',
        label: 'Log details',
        when: {
          kind: 'message',
          messageTypes: ['log'],
        },
        component: {
          module: './panes/LogMessageDetails.tsx',
        },
      },
    });
    registry.register({
      id: 'artifact.trace',
      label: 'Trace artifact',
      target: {
        kind: 'artifact',
        artifactKinds: ['trace'],
      },
      component: {
        module: './renderers/TraceArtifact.tsx',
      },
    });
    registry.register({
      id: 'workspace.browser-page',
      label: 'Browser page',
      target: {
        kind: 'workspace-item',
        workspaceItemTypes: ['browser-page'],
      },
      component: {
        module: './renderers/BrowserPage.tsx',
      },
    });
    registry.register({
      id: 'file.any',
      label: 'Any file',
      target: {
        kind: 'file',
      },
      component: {
        module: './renderers/AnyFile.tsx',
      },
    });

    expect(registry.findForTarget({
      kind: 'file',
      path: 'sounds/theme.wav',
      mimeType: 'audio/wav',
    }).map((renderer) => renderer.id)).toEqual(['audio.visualizer', 'file.any']);
    expect(registry.findForTarget({
      kind: 'message',
      messageType: 'log',
    }).map((renderer) => renderer.id)).toEqual(['log.message']);
    expect(registry.findForTarget({
      kind: 'artifact',
      artifactKind: 'trace',
    }).map((renderer) => renderer.id)).toEqual(['artifact.trace']);
    expect(registry.findForTarget({
      kind: 'workspace-item',
      workspaceItemType: 'browser-page',
    }).map((renderer) => renderer.id)).toEqual(['workspace.browser-page']);
    expect(registry.findForTarget({
      kind: 'artifact',
      artifactKind: 'unknown',
    })).toEqual([]);
    expect(registry.findForTarget({
      kind: 'artifact',
    })).toEqual([]);
    expect(registry.findForTarget({
      kind: 'message',
      messageType: 'metric',
    })).toEqual([]);
    expect(registry.findForTarget({
      kind: 'workspace-item',
      workspaceItemType: 'session',
    })).toEqual([]);
    expect(registry.findForTarget({
      kind: 'file',
    }).map((renderer) => renderer.id)).toEqual(['file.any']);
    expect(registry.findForTarget({
      kind: 'file',
      path: 'sounds/theme.wav',
    }).map((renderer) => renderer.id)).toEqual(['file.any']);
    expect(registry.getPaneItem('log.message.details')?.label).toBe('Log details');
    expect(registry.findPaneItemsForTarget({
      kind: 'file',
      path: 'packages/web/DESIGN.md',
      mimeType: 'text/markdown',
    }).map((paneItem) => paneItem.id)).toEqual(['design-md.designer']);
    expect(registry.findPaneItemsForTarget({
      kind: 'file',
      path: 'packages/web/README.md',
    })).toEqual([]);
    expect(registry.findPaneItemsForTarget({
      kind: 'file',
    })).toEqual([]);
    expect(registry.findPaneItemsForTarget({
      kind: 'message',
      messageType: 'log',
    }).map((paneItem) => paneItem.id)).toEqual(['log.message.details']);
  });

  it('rejects duplicate renderers and pane items', () => {
    const registry = new RendererRegistry();
    const renderer = {
      id: 'pdf.viewer',
      label: 'PDF viewer',
      target: { kind: 'file' as const, fileExtensions: ['.pdf'] },
      component: { module: './renderers/PdfRenderer.tsx' },
    };
    const paneItem = {
      id: 'design-md.designer',
      label: 'Designer',
      when: { kind: 'file' as const, fileNames: ['DESIGN.md'] },
      component: { module: './panes/DesignerPane.tsx' },
    };

    registry.register(renderer);
    registry.registerPaneItem(paneItem);

    expect(() => registry.register(renderer)).toThrow('Renderer already registered: pdf.viewer');
    expect(() => registry.registerPaneItem(paneItem)).toThrow('Pane item already registered: design-md.designer');
  });

  it('lets harness plugins contribute renderers through the extension context', async () => {
    const context = createHarnessExtensionContext();
    const plugin: HarnessPlugin = {
      id: 'agent-harness.ext.media',
      register({ renderers }) {
        renderers.register({
          id: 'media.pdf',
          label: 'PDF',
          target: { kind: 'file', fileExtensions: ['.pdf'] },
          component: { module: './PdfRenderer.tsx' },
        });
      },
    };

    await context.plugins.load(plugin);

    expect(context.renderers.findForTarget({ kind: 'file', path: 'guide.pdf' })).toHaveLength(1);
  });
});
