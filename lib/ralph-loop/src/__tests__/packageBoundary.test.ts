import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packageJsonPath = resolve(packageRoot, 'package.json');
const readmePath = resolve(packageRoot, 'README.md');

describe('package boundary', () => {
  it('declares a stable root TypeScript entry point', () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      main?: string;
      types?: string;
      exports?: Record<string, string>;
    };

    expect(packageJson.main).toBe('./src/index.ts');
    expect(packageJson.types).toBe('./src/index.ts');
    expect(packageJson.exports).toEqual({
      '.': './src/index.ts',
    });
  });

  it('publishes only the README and public TypeScript source', () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      files?: string[];
    };

    expect(packageJson.files).toEqual([
      'README.md',
      'src/index.ts',
      'src/heuristicCompletion.ts',
    ]);
  });

  it('declares logact as a runtime dependency for consumer installs', () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      dependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies).toMatchObject({
      logact: '0.1.0',
    });
  });

  it('documents the root import and private src subpath boundary', () => {
    const readme = readFileSync(readmePath, 'utf8');

    expect(readme).toContain("from 'ralph-loop'");
    expect(readme).toContain('Do not deep-import `src/*`');
    expect(readme).toContain('internal file paths are not a stable contract');
  });
});
