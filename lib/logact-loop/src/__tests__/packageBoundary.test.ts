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

function collectRootExports(source: string): string[] {
  return Array.from(
    source.matchAll(/^\s*export\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+['"][^'"]+['"];?/gm),
    (match) => match[1]
      .split(',')
      .map((name) => name.trim().split(/\s+as\s+/).pop() ?? '')
      .filter(Boolean),
  ).flat().sort();
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
    expect(collectRootExports(indexSource)).toEqual([
      'CoreAgentLoopCallbacks',
      'CoreIterationStep',
      'CoreStepStatus',
      'CoreVoterStep',
      'LOGACT_AGENT_LOOP_HOOK_EVENTS',
      'LogActAgentLoopOptions',
      'WorkflowAgentBus',
      'createLogActWorkflowDefinition',
      'runLogActAgentLoop',
      'type LogActWorkflowDefinition',
      'type LogActWorkflowDefinitionOptions',
      'type WorkflowAgentBusOptions',
      'type WorkflowEvent',
      'type WorkflowMessage',
      'wrapCompletionCheckerWithCallbacks',
      'wrapVoterWithCallbacks',
    ]);
  });

  test('keeps the publish allowlist limited to runtime TypeScript sources and README', () => {
    const packageJson = readPackageJson();

    expect(packageJson.files).toEqual([
      'README.md',
      'src/**/*.ts',
      '!src/**/*.test.ts',
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
    expect(readme).toContain('Published artifacts are intentionally limited to this README');
    expect(readme).toContain('Tests and local package configuration stay');
  });
});
