import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDir, '..');

describe('local model connector package boundaries', () => {
  it('documents stable imports and private implementation modules', () => {
    const readme = fs.readFileSync(path.join(packageRoot, 'README.md'), 'utf8');

    expect(readme).toContain('## Package Boundary');
    expect(readme).toContain("import { createLocalModelConnectorPlugin } from '@agent-harness/ext-local-model-connector'");
    expect(readme).toContain("import manifest from '@agent-harness/ext-local-model-connector/manifest'");
    expect(readme).toContain('@agent-harness/ext-local-model-connector/src/*');
  });

  it('documents and limits the published package surface', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
    ) as {
      exports?: Record<string, string>;
      files?: string[];
      license?: string;
      main?: string;
      repository?: {
        directory?: string;
        type?: string;
        url?: string;
      };
      types?: string;
    };

    expect(packageJson.license).toBe('MIT');
    expect(packageJson.repository).toEqual({
      type: 'git',
      url: 'git+https://github.com/Tyler-R-Kendrick/agent_harness.git',
      directory: 'ext/provider/local-model-connector',
    });
    expect(packageJson.main).toBe('./src/index.ts');
    expect(packageJson.types).toBe('./src/index.ts');
    expect(packageJson.exports).toEqual({
      '.': './src/index.ts',
      './manifest': './agent-harness.plugin.json',
    });
    expect(packageJson.files).toEqual([
      'README.md',
      'agent-harness.plugin.json',
      'manifest.template.json',
      'scripts/**',
      'src/**/*.ts',
      'dist/**',
      '!dist/**/*.map',
      '!src/**/*.test.ts',
      '!src/__tests__/**',
    ]);
  });

  it('documents package license and source location for consumers', () => {
    const readme = fs.readFileSync(path.join(packageRoot, 'README.md'), 'utf8');

    expect(readme).toContain('License: MIT');
    expect(readme).toContain(
      'Source: https://github.com/Tyler-R-Kendrick/agent_harness/tree/main/ext/provider/local-model-connector',
    );
  });
});
