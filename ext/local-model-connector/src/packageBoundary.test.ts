import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDir, '..');

describe('local model connector package boundaries', () => {
  it('documents and limits the published package surface', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
    ) as {
      files?: string[];
    };

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
});
