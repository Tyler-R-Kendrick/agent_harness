import type { HarnessPlugin } from 'harness-core';

export function createCodiBrowserModelProviderPlugin(): HarnessPlugin {
  return {
    id: 'codi-browser-model-provider',
    register() {
      return undefined;
    },
  };
}
