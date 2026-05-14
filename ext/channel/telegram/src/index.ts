import type { HarnessPlugin } from 'harness-core';

export function createTelegramChannelPlugin(): HarnessPlugin {
  return {
    id: 'telegram-channel',
    register() {
      return undefined;
    },
  };
}
