import type { HarnessPlugin } from 'harness-core';

export function createGoogleAiEdgeModelProviderPlugin(): HarnessPlugin {
  return {
    id: 'google-ai-edge-model-provider',
    register() {
      return undefined;
    },
  };
}
