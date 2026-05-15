import type { HarnessPlugin, HarnessRendererDefinition } from 'harness-core';

export interface HyperframesConfig {
  prompt: string;
  style: 'cinematic' | 'product' | 'editorial';
  durationSeconds: 5 | 10 | 15;
  aspectRatio: '16:9' | '9:16' | '1:1';
}

export interface HyperframesArtifact {
  kind: 'hyperframe';
  title: string;
  config: HyperframesConfig;
  files: Array<{ path: string; content: string; mediaType: string }>;
}

export const HYPERFRAMES_RENDERER: HarnessRendererDefinition = {
  id: 'hyperframes.artifact-preview',
  label: 'HyperFrames preview',
  description: 'Renders generated HyperFrames artifact previews.',
  target: {
    kind: 'artifact',
    artifactKinds: ['hyperframe', 'hyperframes-project'],
  },
  implementations: [{
    id: 'hyperframes.preview.react',
    label: 'HyperFrames preview panel',
    runtime: 'react',
    component: { module: './src/index.ts', export: 'HyperframesPreviewRenderer' },
  }],
  priority: 30,
};

export const DEFAULT_HYPERFRAMES_CONFIG: HyperframesConfig = {
  prompt: 'High-energy product reveal with smooth camera motion and soft volumetric light.',
  style: 'cinematic',
  durationSeconds: 10,
  aspectRatio: '16:9',
};

export function createHyperframesArtifact(
  title: string,
  config: Partial<HyperframesConfig> = {},
): HyperframesArtifact {
  const merged = { ...DEFAULT_HYPERFRAMES_CONFIG, ...config };
  return {
    kind: 'hyperframe',
    title: title.trim() || 'Untitled HyperFrame',
    config: merged,
    files: [
      {
        path: 'hyperframe.config.json',
        content: JSON.stringify(merged, null, 2),
        mediaType: 'application/json',
      },
      {
        path: 'preview.html',
        content: createPreviewHtml(title, merged),
        mediaType: 'text/html',
      },
    ],
  };
}

export function createPreviewHtml(title: string, config: HyperframesConfig): string {
  const safeTitle = (title.trim() || 'Untitled HyperFrame').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html>
<html>
  <body>
    <main>
      <h1>${safeTitle}</h1>
      <p data-role="prompt">${config.prompt}</p>
      <ul>
        <li>Style: ${config.style}</li>
        <li>Duration: ${config.durationSeconds}s</li>
        <li>Aspect ratio: ${config.aspectRatio}</li>
      </ul>
      <section data-role="preview">Generated artifact preview placeholder</section>
    </main>
  </body>
</html>`;
}

export function createHyperframesPlugin(): HarnessPlugin {
  return {
    id: 'hyperframes',
    register({ renderers, tools }) {
      renderers.register(HYPERFRAMES_RENDERER);
      tools.register({
        id: 'hyperframes.generate',
        label: 'Generate HyperFrame artifact',
        description: 'Builds a HyperFrames artifact with editor config and preview output.',
        inputSchema: {
          type: 'object',
          properties: { title: { type: 'string' } },
          required: ['title'],
          additionalProperties: true,
        },
        execute: async (rawArgs) => {
          const args = rawArgs as { title?: string } & Partial<HyperframesConfig>;
          return createHyperframesArtifact(args.title ?? 'Untitled HyperFrame', args);
        },
      });
    },
  };
}

export function HyperframesEditorPane(): null {
  return null;
}

export function HyperframesPreviewRenderer(): null {
  return null;
}
