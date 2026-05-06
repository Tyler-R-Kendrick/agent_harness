import type { HarnessPlugin } from 'harness-core';

export function createLocalInferenceDaemonPlugin(): HarnessPlugin {
  return {
    id: 'local-inference-daemon',
    async register() {
      // The daemon is distributed as a downloadable service asset.
    },
  };
}
