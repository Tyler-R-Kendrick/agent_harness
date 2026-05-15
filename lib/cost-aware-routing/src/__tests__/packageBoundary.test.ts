import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import * as publicApi from '../index.js';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

function readPackageFile(path: string): string {
  return readFileSync(join(packageRoot, path), 'utf8');
}

describe('cost-aware-routing package boundary', () => {
  test('publishes only runtime TypeScript sources and README', () => {
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
      '!src/**/*.test.ts',
      '!src/__tests__/**',
    ]);
  });

  test('documents the stable root import and private source boundary', () => {
    const readme = readPackageFile('README.md');

    expect(readme).toContain('## Package boundary');
    expect(readme).toContain("import { routePrompt } from 'cost-aware-routing';");
    expect(readme).toContain('cost-aware-routing/src/*');
  });

  test('keeps root exports explicit so implementation exports do not leak', () => {
    const source = readPackageFile('src/index.ts');

    expect(source).not.toContain('export * from');
    expect(source).toContain("export { extractPromptFeatures } from './featureExtractor.js';");
    expect(source).toContain("export { routePrompt } from './policyEngine.js';");
  });

  test('preserves the current runtime value API from the root entry point', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'DEFAULT_ROUTING_CONFIG',
      'classifyPrompt',
      'computeScoreFromFeatures',
      'extractPromptFeatures',
      'normalizeRoutingConfig',
      'routePrompt',
    ]);
  });
});
