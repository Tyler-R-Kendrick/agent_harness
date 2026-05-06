import type { HarnessPlugin } from 'harness-core';

export function createLocalModelConnectorPlugin(): HarnessPlugin {
  return {
    id: 'local-model-connector',
    async register() {
      // The browser extension is distributed as a loadable asset. Runtime
      // communication happens between the PWA and Chrome/Edge extension APIs.
    },
  };
}
