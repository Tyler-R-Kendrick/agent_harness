import {
  RendererRegistry,
  type HarnessRendererDefinition,
  type HarnessRendererImplementation,
  type HarnessRendererImplementationRuntime,
} from 'harness-core';

import type { ArtifactFile } from './artifacts';

export const BOUNDED_CHAT_RENDERER_ID = 'agent-browser.fallback.bounded-chat';
export const RAW_RENDERER_ID = 'agent-browser.raw-source';

export type NativeMediaRendererKind = 'iframe' | 'image' | 'audio' | 'video' | 'text';

export type ArtifactFileRendererBinding =
  | {
    kind: 'plugin';
    rendererId: string;
    label: string;
    implementationId: string;
    implementationRuntime: HarnessRendererImplementationRuntime;
    rawRendererId: typeof RAW_RENDERER_ID;
    rawAvailable: true;
  }
  | {
    kind: 'native';
    rendererId: string;
    label: string;
    nativeKind: NativeMediaRendererKind;
    rawRendererId: typeof RAW_RENDERER_ID;
    rawAvailable: true;
  }
  | {
    kind: 'bounded-chat';
    rendererId: typeof BOUNDED_CHAT_RENDERER_ID;
    label: 'Chat session';
    rawRendererId: typeof RAW_RENDERER_ID;
    rawAvailable: true;
    reason: string;
  };

export interface ResolveArtifactFileRendererOptions {
  extensionRenderers?: readonly HarnessRendererDefinition[];
}

const NATIVE_RENDERER_PRIORITY = 10;
const TEXT_RENDERER_PRIORITY = 1;
const IMPLEMENTATION_RUNTIME_ORDER: HarnessRendererImplementationRuntime[] = [
  'wasi-preview2',
  'react',
  'web-component',
  'iframe',
  'native-browser',
];

export const DEFAULT_NATIVE_MEDIA_RENDERERS: HarnessRendererDefinition[] = [
  nativeRenderer('agent-browser.native.html', 'HTML', 'iframe', ['text/html'], NATIVE_RENDERER_PRIORITY + 4),
  nativeRenderer('agent-browser.native.svg', 'SVG', 'iframe', ['image/svg+xml'], NATIVE_RENDERER_PRIORITY + 4),
  nativeRenderer('agent-browser.native.image', 'Image', 'image', ['image/*'], NATIVE_RENDERER_PRIORITY + 3),
  nativeRenderer('agent-browser.native.audio', 'Audio', 'audio', ['audio/*'], NATIVE_RENDERER_PRIORITY + 2),
  nativeRenderer('agent-browser.native.video', 'Video', 'video', ['video/*'], NATIVE_RENDERER_PRIORITY + 2),
  nativeRenderer('agent-browser.native.pdf', 'PDF', 'iframe', ['application/pdf'], NATIVE_RENDERER_PRIORITY + 1),
  nativeRenderer('agent-browser.native.text', 'Text', 'text', ['text/*', 'application/json'], TEXT_RENDERER_PRIORITY),
];

export function resolveArtifactFileRenderer(
  file: ArtifactFile | null,
  options: ResolveArtifactFileRendererOptions = {},
): ArtifactFileRendererBinding {
  const mediaType = normalizeMediaType(file?.mediaType);
  const path = file?.path ?? '';
  const extensionRegistry = buildRegistry(options.extensionRenderers ?? []);
  const extensionRenderer = extensionRegistry.findForTarget({
    kind: 'file',
    path,
    mimeType: mediaType,
  })[0];
  if (extensionRenderer) {
    const implementation = chooseImplementation(extensionRenderer);
    if (implementation) {
      return {
        kind: 'plugin',
        rendererId: extensionRenderer.id,
        label: extensionRenderer.label,
        implementationId: implementation.id,
        implementationRuntime: implementation.runtime,
        rawRendererId: RAW_RENDERER_ID,
        rawAvailable: true,
      };
    }
  }

  const nativeRendererDefinition = buildRegistry(DEFAULT_NATIVE_MEDIA_RENDERERS).findForTarget({
    kind: 'file',
    path,
    mimeType: mediaType,
  })[0];
  if (nativeRendererDefinition) {
    return {
      kind: 'native',
      rendererId: nativeRendererDefinition.id,
      label: nativeRendererDefinition.label,
      nativeKind: readNativeKind(nativeRendererDefinition),
      rawRendererId: RAW_RENDERER_ID,
      rawAvailable: true,
    };
  }

  return {
    kind: 'bounded-chat',
    rendererId: BOUNDED_CHAT_RENDERER_ID,
    label: 'Chat session',
    rawRendererId: RAW_RENDERER_ID,
    rawAvailable: true,
    reason: `No installed or native renderer is bound to ${mediaType}.`,
  };
}

function nativeRenderer(
  id: string,
  label: string,
  nativeKind: NativeMediaRendererKind,
  mimeTypes: readonly string[],
  priority: number,
): HarnessRendererDefinition {
  return {
    id,
    label,
    target: {
      kind: 'file',
      mimeTypes,
    },
    implementations: [{
      id: `${id}.default`,
      runtime: 'native-browser',
      module: `agent-browser://${nativeKind}`,
    }],
    priority,
  };
}

function buildRegistry(renderers: readonly HarnessRendererDefinition[]): RendererRegistry {
  const registry = new RendererRegistry();
  for (const renderer of renderers) {
    registry.register(renderer);
  }
  return registry;
}

function chooseImplementation(renderer: HarnessRendererDefinition): HarnessRendererImplementation | null {
  const implementations = renderer.implementations ?? (renderer.component
    ? [{
      id: `${renderer.id}.component`,
      runtime: 'react' as const,
      component: renderer.component,
    }]
    : []);
  return [...implementations].sort((left, right) => (
    IMPLEMENTATION_RUNTIME_ORDER.indexOf(left.runtime) - IMPLEMENTATION_RUNTIME_ORDER.indexOf(right.runtime)
  ))[0] ?? null;
}

function readNativeKind(renderer: HarnessRendererDefinition): NativeMediaRendererKind {
  const implementationModule = renderer.implementations?.[0]?.module ?? '';
  if (implementationModule.endsWith('://image')) return 'image';
  if (implementationModule.endsWith('://audio')) return 'audio';
  if (implementationModule.endsWith('://video')) return 'video';
  if (implementationModule.endsWith('://text')) return 'text';
  return 'iframe';
}

function normalizeMediaType(mediaType: string | undefined): string {
  return mediaType?.split(';')[0]?.trim().toLowerCase() || 'application/octet-stream';
}
