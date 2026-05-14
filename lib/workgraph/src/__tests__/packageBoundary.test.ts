import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import * as publicApi from '../index.js';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

function readPackageFile(path: string): string {
  return readFileSync(join(packageRoot, path), 'utf8');
}

describe('workgraph package boundary', () => {
  test('publishes only runtime TypeScript sources and README', () => {
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
      'src/**/*.{ts,tsx}',
      '!src/**/*.test.ts',
      '!src/__tests__/**',
    ]);
  });

  test('documents the stable root import and private source boundary', () => {
    const readme = readPackageFile('README.md');

    expect(readme).toContain('## Package boundary');
    expect(readme).toContain("import { createWorkGraph } from '@agent-harness/workgraph';");
    expect(readme).toContain('@agent-harness/workgraph/src/*');
  });

  test('keeps root exports explicit so implementation exports do not leak', () => {
    const source = readPackageFile('src/index.ts');

    expect(source).not.toContain('export * from');
    expect(source).toContain("export { createWorkGraph } from './commands/command-bus.js';");
    expect(source).toContain("export { createInMemoryWorkGraphRepository } from './store/repository.js';");
    expect(source).toContain("export { searchWorkGraph } from './search/search-service.js';");
  });

  test('preserves the current runtime value API from the root entry point', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'WorkGraphCommandError',
      'WorkGraphDexieDatabase',
      'WorkGraphProvider',
      'applyAgentIssueProposal',
      'createAgentIssueProposal',
      'createFixedWorkGraphTimeSource',
      'createInMemoryWorkGraphRepository',
      'createSequentialWorkGraphIdFactory',
      'createSystemWorkGraphTimeSource',
      'createWorkGraph',
      'createWorkGraphExternalStore',
      'enqueueWorkGraphAutomationTask',
      'exportWorkGraph',
      'importWorkGraph',
      'materializeWorkGraphProjection',
      'priorityRank',
      'searchWorkGraph',
      'selectIssuesForView',
      'sortIssuesByPriority',
      'useWorkGraphState',
      'useWorkGraphStore',
      'workGraphAutomationTaskType',
    ]);
  });
});
