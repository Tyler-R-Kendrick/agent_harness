import {
  createExternalMessageHandler,
  registerStreamPort,
  type ChromePermissionsLike,
  type ExtensionManifestLike,
  type StreamPortLike,
} from './messages';
import type { ChromeStorageAreaLike } from './storage';

interface RuntimeLike {
  getManifest(): ExtensionManifestLike;
  onMessageExternal: {
    addListener(listener: (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => true): void;
  };
  onConnectExternal: {
    addListener(listener: (port: StreamPortLike) => void): void;
  };
}

interface ChromeLike {
  runtime: RuntimeLike;
  permissions: ChromePermissionsLike;
  storage: {
    local: ChromeStorageAreaLike;
  };
}

declare const chrome: ChromeLike | undefined;

export function registerLocalModelConnector(chromeApi: ChromeLike): void {
  const manifest = chromeApi.runtime.getManifest();
  const env = {
    allowedSenderPatterns: manifest.externally_connectable?.matches ?? [],
    permissions: chromeApi.permissions,
    storage: chromeApi.storage.local,
    manifest,
  };
  const handleMessage = createExternalMessageHandler(env);
  chromeApi.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    void handleMessage(message, sender as Parameters<typeof handleMessage>[1]).then(sendResponse);
    return true;
  });
  chromeApi.runtime.onConnectExternal.addListener((port) => registerStreamPort(port, env));
}

/* v8 ignore next 3 */
if (typeof chrome !== 'undefined' && chrome.runtime) {
  registerLocalModelConnector(chrome);
}
