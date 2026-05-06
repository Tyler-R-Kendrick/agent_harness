import { describe, expect, it, vi } from 'vitest';

import { registerLocalModelConnector } from './background';

describe('MV3 background registration', () => {
  it('registers external message and stream port listeners from the manifest allowlist', async () => {
    let messageListener: ((message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => true) | undefined;
    let portListener: ((port: never) => void) | undefined;
    const chromeApi = {
      runtime: {
        getManifest: () => ({
          name: 'Local Model Connector',
          version: '0.1.0',
          externally_connectable: { matches: ['https://app.example.com/*'] },
        }),
        onMessageExternal: {
          addListener: vi.fn((listener) => {
            messageListener = listener;
          }),
        },
        onConnectExternal: {
          addListener: vi.fn((listener) => {
            portListener = listener;
          }),
        },
      },
      permissions: {
        contains: vi.fn(async () => true),
        request: vi.fn(async () => true),
      },
      storage: {
        local: {
          get: vi.fn(async () => ({})),
          set: vi.fn(async () => undefined),
          remove: vi.fn(async () => undefined),
        },
      },
    };

    registerLocalModelConnector(chromeApi);
    expect(chromeApi.runtime.onMessageExternal.addListener).toHaveBeenCalledTimes(1);
    expect(chromeApi.runtime.onConnectExternal.addListener).toHaveBeenCalledTimes(1);
    expect(portListener).toBeTypeOf('function');

    const responses: unknown[] = [];
    const keepAlive = messageListener?.({ type: 'ping' }, { origin: 'https://app.example.com' }, (response) => responses.push(response));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(keepAlive).toBe(true);
    expect(responses).toEqual([{ ok: true, data: { name: 'Local Model Connector', version: '0.1.0' } }]);
  });
});
