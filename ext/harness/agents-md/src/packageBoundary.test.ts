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
  it('publishes only runtime plugin files', () => {
    const packageJson = readJson('package.json');

    expect(packageJson.exports).toEqual({
      '.': './src/index.ts',
      './manifest': './agent-harness.plugin.json',
    });
    expect(packageJson.files).toEqual([
      'README.md',
      'agent-harness.plugin.json',
      'src/**/*.ts',
      '!src/**/*.test.ts',
      '!src/__tests__/**',
    ]);
  });

  it('documents the stable import and manifest boundary', () => {
    const readme = readText('README.md');

    expect(readme).toContain("import { createAgentsMdHookPlugin } from '@agent-harness/ext-agents-md';");
    expect(readme).toContain("import manifest from '@agent-harness/ext-agents-md/manifest';");
    expect(readme).toContain('Do not deep-import files under `src/`');
  });
});
