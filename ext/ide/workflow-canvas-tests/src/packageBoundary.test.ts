import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readPackageJson() {
  return JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8')) as {
    private?: boolean;
    files?: string[];
    scripts?: Record<string, string>;
  };
}

function readReadme() {
  return readFileSync(path.join(packageRoot, 'README.md'), 'utf8');
}

describe('workflow canvas test harness package boundary', () => {
  it('stays private and documents its ownership boundary', () => {
    const packageJson = readPackageJson();
    const readme = readReadme();

    expect(packageJson.private).toBe(true);
    expect(packageJson.files).toBeUndefined();
    expect(packageJson.scripts).toMatchObject({
      test: 'npm run test:unit',
      'test:coverage': 'node ../../../scripts/run-package-bin.mjs vitest run --coverage --config vitest.config.ts',
      'test:e2e': 'node ../../../scripts/run-package-bin.mjs playwright test --config playwright.config.ts',
    });

    expect(readme).toContain('@agent-harness/ext-workflow-canvas-tests');
    expect(readme).toContain('private test harness');
    expect(readme).toContain('Do not publish this package');
    expect(readme).toContain('Workflow Canvas extension');
    expect(readme).toContain('npm.cmd --workspace @agent-harness/ext-workflow-canvas-tests run test:unit');
    expect(readme).toContain('npm.cmd --workspace @agent-harness/ext-workflow-canvas-tests run test:e2e');
  });
});
