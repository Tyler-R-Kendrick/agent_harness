import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

function readPackageJson(): {
  main?: string;
  types?: string;
  files?: string[];
  exports?: Record<string, string>;
} {
  return JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
}

function readText(path: string): string {
  return readFileSync(join(packageRoot, path), 'utf8');
}

describe('harness-core package boundary', () => {
  test('publishes the root entry point and documented extension subpaths', () => {
    const packageJson = readPackageJson();

    expect(packageJson.main).toBe('./src/index.ts');
    expect(packageJson.types).toBe('./src/index.ts');
    expect(packageJson.exports).toEqual({
      '.': './src/index.ts',
      './ext/agent-skills': './src/ext/agent-skills.ts',
      './ext/agents-md': './src/ext/agents-md.ts',
      './ext/design-md': './src/ext/design-md.ts',
    });
  });

  test('keeps the publish allowlist limited to runtime TypeScript sources and README', () => {
    const packageJson = readPackageJson();

    expect(packageJson.files).toEqual([
      'README.md',
      'src/**/*.ts',
      '!src/__tests__/**',
    ]);
  });

  test('documents the stable import paths and private source boundary', () => {
    const readme = readText('README.md');

    expect(readme).toContain('## Package boundary');
    expect(readme).toContain("import { createAgentRuntime } from 'harness-core';");
    expect(readme).toContain("import { createAgentSkillsPlugin } from 'harness-core/ext/agent-skills';");
    expect(readme).toContain("import { createAgentsMdHookPlugin } from 'harness-core/ext/agents-md';");
    expect(readme).toContain("import { createDesignMdPlugin } from 'harness-core/ext/design-md';");
    expect(readme).toContain('Deep imports from `harness-core/src/*` are internal implementation details.');
  });
});
