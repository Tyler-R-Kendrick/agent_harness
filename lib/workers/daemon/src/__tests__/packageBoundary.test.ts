import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';
import * as workerDaemon from '../index';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

function readPackageFile(path: string): string {
  return readFileSync(join(packageRoot, path), 'utf8');
}

describe('worker-daemon package boundary', () => {
  test('publishes only runtime TypeScript sources and README', () => {
    const packageJson = JSON.parse(readPackageFile('package.json')) as {
      license: string;
      main: string;
      types: string;
      exports: Record<string, string>;
      files: string[];
    };

    expect(packageJson.license).toBe('MIT');
    expect(packageJson.main).toBe('./src/index.ts');
    expect(packageJson.types).toBe('./src/index.ts');
    expect(packageJson.exports).toEqual({ '.': './src/index.ts' });
    expect(packageJson.files).toEqual([
      'README.md',
      'src/**/*.ts',
      '!src/**/*.test.ts',
      '!src/__tests__/**',
    ]);
  });

  test('documents the stable root import and private source boundary', () => {
    const readme = readPackageFile('README.md');

    expect(readme).toContain('## Package Boundary');
    expect(readme).toContain("import { DaemonWorkerProvider } from '@agent-harness/worker-daemon';");
    expect(readme).toContain('@agent-harness/worker-daemon/src/*');
  });

  test('keeps the root entry point explicit and stable', () => {
    const indexSource = readPackageFile('src/index.ts');

    expect(indexSource).not.toContain('export * from');
    expect(Object.keys(workerDaemon).sort()).toEqual([
      'CapDaemonLocalInference',
      'CapDaemonRequest',
      'DaemonRuntimeType',
      'DaemonWorker',
      'DaemonWorkerProvider',
      'DaemonWorkerProviderId',
      'DaemonWorkerType',
    ]);
  });
});
