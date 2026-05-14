import type { HarnessPlugin } from 'harness-core';

export function createSlackChannelPlugin(): HarnessPlugin {
  return {
    id: 'slack-channel',
    register() {
      return undefined;
    },
  };
}
