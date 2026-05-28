import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as publicApi from '../index.js';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function readPackageJson() {
  return JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as {
    main?: string;
    types?: string;
    files?: string[];
    exports?: Record<string, string>;
  };
}

describe('git-stub package boundary', () => {
  it('publishes only the documented root entry point and runtime sources', () => {
    const packageJson = readPackageJson();

    expect(packageJson.main).toBe('./src/index.ts');
    expect(packageJson.types).toBe('./src/index.ts');
    expect(packageJson.exports).toEqual({
      '.': './src/index.ts',
    });
    expect(packageJson.files).toEqual([
      'README.md',
      'src/**/*.ts',
      '!src/__tests__/**',
      '!src/**/*.test.ts',
    ]);
  });

  it('documents the stable root import and private implementation modules', () => {
    const readme = readFileSync(resolve(packageRoot, 'README.md'), 'utf8');

    expect(readme).toContain('## Package boundary');
    expect(readme).toContain("import { createGitStubRepository, executeGitStubCommand } from '@agent-harness/git-stub'");
    expect(readme).toContain('`src/repository.ts` and `src/types.ts` are implementation modules');
    expect(readme).toContain('### Public API');
    expect(readme).toContain('`createGitStubRepository`');
    expect(readme).toContain('`executeGitStubCommand`');
    expect(readme).toContain('`isGitStubCommand`');
  });

  it('keeps root exports explicit and limited to the supported runtime API', () => {
    const indexSource = readFileSync(resolve(packageRoot, 'src/index.ts'), 'utf8');

    expect(indexSource).not.toContain('export * from');
    expect(Object.keys(publicApi).sort()).toEqual([
      'createGitStubRepository',
      'executeGitStubCommand',
      'isGitStubCommand',
    ]);
  });
});
