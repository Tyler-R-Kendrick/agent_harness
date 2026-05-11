import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(path.join(packageRoot, relativePath), 'utf8'));
}

function readText(relativePath: string) {
  return readFileSync(path.join(packageRoot, relativePath), 'utf8');
}

describe('package boundary', () => {
  it('publishes the documented runtime and manifest entry points', () => {
    const packageJson = readJson('package.json');

    expect(packageJson.exports).toEqual({
      '.': './src/index.ts',
      './board': './src/board.ts',
      './manifest': './agent-harness.plugin.json',
    });
    expect(packageJson.files).toEqual([
      'README.md',
      'agent-harness.plugin.json',
      'src/**/*.ts',
      'examples/**',
      '!src/**/*.test.ts',
      '!src/__tests__/**',
    ]);
  });

  it('documents stable imports and private implementation paths', () => {
    const readme = readText('README.md');

    expect(readme).toContain("import { createSymphonyPlugin } from '@agent-harness/ext-symphony';");
    expect(readme).toContain("import { createDefaultSymphonyBoardState } from '@agent-harness/ext-symphony/board';");
    expect(readme).toContain("import manifest from '@agent-harness/ext-symphony/manifest';");
    expect(readme).toContain('Do not deep-import files under `src/`');
  });

  it('keeps root exports explicit so board internals are intentional', () => {
    const source = readText('src/index.ts');

    expect(source).not.toContain("export * from './board.js';");
    expect(source).toContain("export {");
    expect(source).toContain("} from './board.js';");
  });
});
