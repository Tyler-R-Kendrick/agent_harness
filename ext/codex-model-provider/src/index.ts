import type { HarnessPlugin } from 'harness-core';

export function createCodexModelProviderPlugin(): HarnessPlugin {
  return {
    id: 'codex-model-provider',
    register() {
      return undefined;
    },
  };
}
