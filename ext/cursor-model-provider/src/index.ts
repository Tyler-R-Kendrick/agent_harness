import type { HarnessPlugin } from 'harness-core';

export function createCursorModelProviderPlugin(): HarnessPlugin {
  return {
    id: 'cursor-model-provider',
    register() {
      return undefined;
    },
  };
}
