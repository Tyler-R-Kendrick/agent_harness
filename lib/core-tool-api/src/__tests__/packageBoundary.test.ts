import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as coreToolApi from '../index.js';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const readPackageFile = (relativePath: string) => readFile(join(packageRoot, relativePath), 'utf8');

it('documents the stable root import and private source boundary', async () => {
  const readme = await readPackageFile('README.md');

  expect(readme).toContain("import { CoreToolApi } from '@agent-harness/core-tool-api'");
  expect(readme).toContain('@agent-harness/core-tool-api/src/*');
  expect(readme).toContain('private implementation paths');
});

it('publishes runtime source files through the root package entry point', async () => {
  const packageJson = JSON.parse(await readPackageFile('package.json')) as {
    exports: Record<string, string>;
    files: string[];
    main: string;
    types: string;
  };

  expect(packageJson.main).toBe('./src/index.ts');
  expect(packageJson.types).toBe('./src/index.ts');
  expect(packageJson.exports).toEqual({ '.': './src/index.ts' });
  expect(packageJson.files).toEqual(['README.md', 'src/**/*.ts', '!src/__tests__/**']);
});

it('keeps root exports explicit and preserves the runtime API', async () => {
  const indexSource = await readPackageFile('src/index.ts');

  expect(indexSource).not.toContain('export * from');
  expect(indexSource).toContain("export { CoreToolApi } from './coreToolApi.js';");
  expect(indexSource).toContain("export type {");
  expect(Object.keys(coreToolApi).sort()).toEqual(['CoreToolApi']);
});
