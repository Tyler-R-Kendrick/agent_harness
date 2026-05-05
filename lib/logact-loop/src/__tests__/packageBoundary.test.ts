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

describe('logact-loop package boundary', () => {
  test('publishes a single root TypeScript entry point', () => {
    const packageJson = readPackageJson();

    expect(packageJson.main).toBe('./src/index.ts');
    expect(packageJson.types).toBe('./src/index.ts');
    expect(packageJson.exports).toEqual({
      '.': './src/index.ts',
    });
  });

  test('keeps root exports explicit', () => {
    const indexSource = readText('src/index.ts');

    expect(indexSource).not.toMatch(/export\s+\*\s+from/);
    expect(indexSource).toContain('LOGACT_AGENT_LOOP_HOOK_EVENTS');
    expect(indexSource).toContain('WorkflowAgentBus');
    expect(indexSource).toContain('createLogActWorkflowDefinition');
    expect(indexSource).toContain('runLogActAgentLoop');
    expect(indexSource).toContain('wrapCompletionCheckerWithCallbacks');
    expect(indexSource).toContain('wrapVoterWithCallbacks');
    expect(indexSource).toContain('LogActAgentLoopOptions');
  });

  test('keeps the publish allowlist limited to runtime TypeScript sources and README', () => {
    const packageJson = readPackageJson();

    expect(packageJson.files).toEqual([
      'README.md',
      'src/**/*.ts',
      '!src/__tests__/**',
    ]);
  });

  test('documents the stable import path and private source boundary', () => {
    const readme = readText('README.md');

    expect(readme).toContain('## Package boundary');
    expect(readme).toContain("import { runLogActAgentLoop } from '@agent-harness/logact-loop';");
    expect(readme).toContain('The package exposes one stable public import path: `@agent-harness/logact-loop`.');
    expect(readme).toContain('Deep imports from `@agent-harness/logact-loop/src/*` are internal');
    expect(readme).toContain('implementation details.');
  });
});
