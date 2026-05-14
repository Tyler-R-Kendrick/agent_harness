import type { HarnessPlugin } from 'harness-core';

export function createSmsChannelPlugin(): HarnessPlugin {
  return {
    id: 'sms-channel',
    register() {
      return undefined;
    },
  };
}
