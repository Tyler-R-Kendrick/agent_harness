import type { HarnessPlugin } from 'harness-core';

export function createGhcpModelProviderPlugin(): HarnessPlugin {
  return {
    id: 'ghcp-model-provider',
    register() {
      return undefined;
    },
  };
}
