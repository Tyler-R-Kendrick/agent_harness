import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readPackageFile(path: string): string {
  return readFileSync(join(packageRoot, path), 'utf8');
}

describe('package boundary', () => {
  test('documents the stable root import boundary', () => {
    const readme = readPackageFile('README.md');

    expect(readme).toContain('## Package boundary');
    expect(readme).toContain("import { BrowserSandboxProvider } from '@agent-harness/agent-sandbox'");
    expect(readme).toContain('@agent-harness/agent-sandbox/src/*');
  });

  test('publishes only the documented runtime source files', () => {
    const packageJson = JSON.parse(readPackageFile('package.json')) as {
      main: string;
      types: string;
      exports: Record<string, string>;
      files: string[];
    };

    expect(packageJson.main).toBe('./src/index.ts');
    expect(packageJson.types).toBe('./src/index.ts');
    expect(packageJson.exports).toEqual({ '.': './src/index.ts' });
    expect(packageJson.files).toEqual(['README.md', 'src/**/*.ts', '!src/__tests__/**']);
  });

  test('keeps root exports explicit instead of wildcarding implementation modules', () => {
    const indexSource = readPackageFile('src/index.ts');
    const exportLines = indexSource
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    expect(indexSource).not.toMatch(/export\s+\*\s+from/);
    expect(exportLines).toEqual([
      "export { BrowserSandboxProvider, DEFAULT_ALLOW_NETWORK, DEFAULT_MAX_OUTPUT_BYTES, DEFAULT_TIMEOUT_MS } from './BrowserSandboxProvider';",
      "export { QuickJsWasmSandbox, QuickJsWasmSandboxProvider, QuickJsWasmSandboxProviderId, QuickJsWasmSandboxType } from './QuickJsWasmSandboxProvider';",
      "export type { QuickJsWasmSandboxOptions, QuickJsWasmSandboxProviderOptions } from './QuickJsWasmSandboxProvider';",
      "export { WebContainerBrowserSandboxProvider } from './WebContainerBrowserSandboxProvider';",
      "export type { WebContainerBrowserSandboxOptions } from './WebContainerBrowserSandboxProvider';",
      "export { DeepAgentsBrowserSandboxAdapter } from './adapters';",
      "export { SandboxClosedError, SandboxExecutionError, SandboxPathError, SandboxQuotaError, SandboxTimeoutError } from './errors';",
      "export { SandboxFetchPolicy } from './network';",
      "export type { SandboxFetchInit, SandboxFetchPolicyOptions, SandboxFetchResponse } from './network';",
      "export { createSandboxPreview } from './preview';",
      "export type { SandboxPreviewHandle, SandboxPreviewOptions } from './preview';",
      "export { parseSkillManifest } from './skillManifest';",
      "export type { SkillManifest, SkillManifestOptions } from './skillManifest';",
      "export { AgentSandbox, Sandbox } from './types';",
      "export type { BrowserSandboxOptions, SandboxComputeCapability, SandboxExecuteResponse, SandboxFileDownloadResponse, SandboxFileSystemCapability, SandboxFileUploadResponse, SandboxIsolationCapability, SandboxWorkerConfigureRequest, SandboxWorkerMessage, SandboxWorkerPort, SandboxWorkerRequest, SandboxWorkerResponse, SkillSandbox } from './types';",
      "export { DEFAULT_MAX_FILE_BYTES, DEFAULT_MAX_TOTAL_BYTES, InMemoryVirtualFileSystem, normalizeSandboxPath } from './vfs';",
      "export type { VirtualFileSystemOptions } from './vfs';",
    ]);
  });
});
