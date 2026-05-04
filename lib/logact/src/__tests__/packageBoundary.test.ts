import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import * as publicApi from 'logact';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDir, '../..');

describe('package boundaries', () => {
  it('exposes the documented package entry point', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'AllowlistVoter',
      'ClassicVoter',
      'GitAgentBus',
      'InMemoryAgentBus',
      'LLMPassiveVoter',
      'LogActAgent',
      'MockGitRepository',
      'PayloadType',
      'QuorumPolicy',
      'buildExecutionSummary',
      'evaluateQuorum',
      'getAbortedIntents',
      'getResults',
    ]);
  });

  it('documents and limits the published package surface', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
    ) as {
      files?: string[];
    };

    expect(fs.existsSync(path.join(packageRoot, 'README.md'))).toBe(true);
    expect(packageJson.files).toEqual([
      'README.md',
      'src/**/*.ts',
      '!src/__tests__/**',
    ]);
  });
});
