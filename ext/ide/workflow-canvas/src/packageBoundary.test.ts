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

describe('workflow canvas package boundary', () => {
  it('publishes only runtime extension files through documented entry points', () => {
    const packageJson = readJson('package.json');

    expect(packageJson.exports).toEqual({
      '.': './src/index.ts',
      './manifest': './agent-harness.plugin.json',
    });
    expect(packageJson.files).toEqual([
      'README.md',
      'agent-harness.plugin.json',
      'src/**/*.ts',
      'src/**/*.tsx',
      '!src/**/*.test.ts',
      '!src/**/*.test.tsx',
      '!src/__tests__/**',
    ]);
  });

  it('documents stable imports and keeps source deep imports private', () => {
    const readme = readText('README.md');

    expect(readme).toContain("import { WorkflowCanvasRenderer } from '@agent-harness/ext-workflow-canvas';");
    expect(readme).toContain("import manifest from '@agent-harness/ext-workflow-canvas/manifest';");
    expect(readme).toContain('Do not deep-import files under `src/`');
    expect(readme).toContain('Published package contents intentionally include');
  });

  it('keeps the root entry point explicit instead of wildcard-exported', () => {
    const indexSource = readText('src/index.ts');

    expect(indexSource).not.toMatch(/export\s+\*\s+from/);
    expect(indexSource).toContain("from './WorkflowCanvasWorkbench.js'");
  });
});
