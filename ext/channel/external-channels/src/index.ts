import type { HarnessPlugin } from 'harness-core';

export function createExternalChannelsPlugin(): HarnessPlugin {
  return {
    id: 'external-channels',
    register() {
      return undefined;
    },
  };
}
