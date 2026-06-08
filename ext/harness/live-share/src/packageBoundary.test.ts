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

describe('live-share package boundary', () => {
  it('publishes only runtime plugin files', () => {
    const packageJson = readJson('package.json') as {
      exports?: Record<string, string>;
      files?: string[];
      license?: string;
      repository?: {
        directory?: string;
        type?: string;
        url?: string;
      };
    };

    expect(packageJson.license).toBe('MIT');
    expect(packageJson.repository).toEqual({
      type: 'git',
      url: 'https://github.com/Tyler-R-Kendrick/agent_harness.git',
      directory: 'ext/harness/live-share',
    });
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

  it('documents the stable import and private source boundary', () => {
    const readme = readText('README.md');

    expect(readme).toContain('License: MIT');
    expect(readme).toContain(
      'Source: https://github.com/Tyler-R-Kendrick/agent_harness/tree/main/ext/harness/live-share',
    );
    expect(readme).toContain("import { createLiveSharePlugin } from '@agent-harness/ext-live-share';");
    expect(readme).toContain("import manifest from '@agent-harness/ext-live-share/manifest';");
    expect(readme).toContain('Do not deep-import files under `src/`');
    expect(readme).toContain('Published package contents are limited to');
  });
});
