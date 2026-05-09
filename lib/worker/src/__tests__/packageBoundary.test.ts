import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as publicApi from '../index';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const readPackageFile = (path: string) => readFileSync(resolve(packageRoot, path), 'utf8');

describe('package boundary', () => {
  it('documents the stable root entry point and private source modules', () => {
    const readme = readPackageFile('README.md');

    expect(readme).toContain('## Package boundary');
    expect(readme).toContain('@agent-harness/worker');
    expect(readme).toContain('Do not deep-import `src/*`');
  });

  it('publishes only the package docs, metadata, and runtime TypeScript source', () => {
    const packageJson = JSON.parse(readPackageFile('package.json')) as {
      main: string;
      types: string;
      exports: Record<string, string>;
      files: string[];
    };

    expect(packageJson.main).toBe('./src/index.ts');
    expect(packageJson.types).toBe('./src/index.ts');
    expect(packageJson.exports).toEqual({ '.': './src/index.ts' });
    expect(packageJson.files).toEqual([
      'README.md',
      'src/**/*.ts',
      '!src/__tests__/**',
    ]);
  });

  it('keeps the root public API explicit', () => {
    const source = readPackageFile('src/index.ts');

    expect(source).not.toMatch(/export\s+\*\s+from/);
    expect(source).toContain("export { DeepAgentsSandboxAdapter } from './adapters';");
    expect(source).toMatch(/export\s+\{[\s\S]*DefaultWorkerBroker[\s\S]*DefaultWorkerResolver[\s\S]*\}\s+from '\.\/worker';/);
    expect(source).toMatch(/export\s+type\s+\{[\s\S]*Worker[\s\S]*WorkerProvider[\s\S]*\}\s+from '\.\/worker';/);
  });

  it('exports the documented runtime values from the root entry point', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'CapExecJavaScript',
      'CapExecPython',
      'CapExecShell',
      'CapFsVirtual',
      'CapFsWorkspaceScoped',
      'CapIsolationContainer',
      'CapIsolationMicrovm',
      'CapIsolationWasm',
      'CapLifecycleLongRunning',
      'CapNetworkEgress',
      'CapPackagesNpm',
      'CapPersistenceDurable',
      'CapPersistenceEphemeral',
      'CapPreviewHtml',
      'CapPreviewPort',
      'CapProcessNative',
      'DeepAgentsSandboxAdapter',
      'DefaultCapabilityMatcher',
      'DefaultCapabilitySet',
      'DefaultPolicyEngine',
      'DefaultProviderRegistry',
      'DefaultSandboxBroker',
      'DefaultSandboxResolver',
      'DefaultWorkerBroker',
      'DefaultWorkerResolver',
      'EventArtifactCreated',
      'EventDiagnosticCreated',
      'EventJobAccepted',
      'EventJobCompleted',
      'EventJobFailed',
      'EventSandboxCreated',
      'EventSandboxStderr',
      'EventSandboxStdout',
      'EventWorkerStarted',
      'InMemoryArtifactStore',
      'SandboxProviderMarker',
      'SurfaceSandboxAdapter',
      'SurfaceSandboxProvider',
      'SurfaceWorkerAdapter',
      'SurfaceWorkerProvider',
      'WorkerProviderMarker',
      'capabilityId',
      'eventTypeId',
      'isSandboxProvider',
      'isWorkerProvider',
      'jobIntentId',
      'providerId',
      'runtimeTypeId',
      'sandboxTypeId',
      'workerTypeId',
    ]);
  });
});
