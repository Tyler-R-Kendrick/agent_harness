export interface SandboxPreviewHandle {
  iframe: HTMLIFrameElement;
  url: string;
  dispose(): void;
}

export interface SandboxPreviewOptions {
  document?: Document;
  parent?: HTMLElement;
  sandbox?: string;
}

const DEFAULT_PREVIEW_SANDBOX = 'allow-scripts';

export function createSandboxPreview(html: string, options: SandboxPreviewOptions = {}): SandboxPreviewHandle {
  const documentRef = options.document ?? document;
  const parent = options.parent ?? documentRef.body;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const iframe = documentRef.createElement('iframe');
  iframe.setAttribute('sandbox', options.sandbox ?? DEFAULT_PREVIEW_SANDBOX);
  iframe.src = url;
  parent.appendChild(iframe);

  return {
    iframe,
    url,
    dispose() {
      iframe.remove();
      URL.revokeObjectURL(url);
    },
  };
}
