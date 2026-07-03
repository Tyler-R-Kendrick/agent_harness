import { describe, expect, it, vi } from 'vitest';

// Capture the options passed to the default browser sandbox provider so we can
// assert the compiled policy's browserOptions are threaded through.
const providerConstructions: unknown[] = [];

vi.mock('@agent-harness/agent-sandbox', () => {
  class FakeBrowserSandbox {
    readonly id = 'fake-browser-sandbox';
    constructor(public readonly options?: unknown) {
      providerConstructions.push(options);
    }
    async uploadFiles(files: Array<[string, Uint8Array]>) {
      return files.map(([path]) => ({ path, error: null }));
    }
    async execute() {
      return { output: 'ok', exitCode: 0, truncated: false, durationMs: 1 };
    }
    async downloadFiles(paths: string[]) {
      return paths.map((path) => ({ path, content: null, error: null }));
    }
    async reset() {}
    async close() {}
  }
  return {
    BrowserSandboxProvider: FakeBrowserSandbox,
    WebContainerBrowserSandboxProvider: FakeBrowserSandbox,
  };
});

import { createSandboxExecutionService } from './service';
import type { RunRequest } from './protocol';
import type { CompiledSandboxPolicy } from '@agent-harness/sandbox-policy';

function runRequest(): RunRequest {
  return {
    files: [{ path: 'main.sh', content: 'echo hi' }],
    command: { command: 'echo', args: ['hi'] },
  };
}

describe('sandbox execution service — compiled policy', () => {
  it('threads the policy browserOptions into the default provider', async () => {
    providerConstructions.length = 0;
    const policy: CompiledSandboxPolicy = {
      browserOptions: {
        allowNetwork: true,
        network: { allowedOrigins: ['https://example.com'], allowedMethods: ['GET'] },
        maxOutputBytes: 4096,
      },
      networkPolicy: 'restricted',
      limits: { maxRuntimeMs: 5000 },
      permissions: { network: true, storage: 'none', dom: false },
      unsupportedDirectives: [],
    };

    const service = createSandboxExecutionService({
      flags: {
        secureBrowserSandboxExec: true,
        disableWebContainerAdapter: true,
        allowSameOriginForWebContainer: false,
      },
      policy,
    });
    const session = await service.createSession();
    await session.run(runRequest());

    expect(providerConstructions).toContainEqual(policy.browserOptions);
  });

  it('constructs the provider with no options when no policy is supplied', async () => {
    providerConstructions.length = 0;
    const service = createSandboxExecutionService({
      flags: {
        secureBrowserSandboxExec: true,
        disableWebContainerAdapter: true,
        allowSameOriginForWebContainer: false,
      },
    });
    const session = await service.createSession();
    await session.run(runRequest());

    expect(providerConstructions).toContainEqual(undefined);
  });
});
