import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as publicApi from '../index';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

function readPackageFile(path: string): string {
  return readFileSync(join(packageRoot, path), 'utf8');
}

describe('prompt-budget package boundary', () => {
  it('publishes only runtime TypeScript sources and README', () => {
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

  it('documents the stable root import and private source boundary', () => {
    const readme = readPackageFile('README.md');

    expect(readme).toContain('## Package Boundary');
    expect(readme).toContain('@agent-harness/prompt-budget');
    expect(readme).toContain('@agent-harness/prompt-budget/src/*');
    expect(readme).toContain('Published artifacts are intentionally runtime-only');
  });

  it('keeps the root entry point explicit so implementation exports do not leak', () => {
    const source = readPackageFile('src/index.ts');

    expect(source).not.toContain('export * from');
    expect(source).toContain('export {');
    expect(source).toContain('createPromptBudget');
    expect(source).toContain('export type {');
    expect(source).toContain('PromptBudgetCapabilities');
  });

  it('preserves the current runtime value API from the root entry point', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'createPromptBudget',
      'estimateTokenCount',
      'fitMessagesToBudget',
      'fitTextToTokenBudget',
      'normalizeModelMessage',
    ]);
  });
});
