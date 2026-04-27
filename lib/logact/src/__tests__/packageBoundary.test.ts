import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDir, '../..');

describe('package boundaries', () => {
  it('publishes only package consumer artifacts', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')) as {
      files?: string[];
    };

    expect(packageJson.files).toEqual([
      'README.md',
      'src/**/*.ts',
      '!src/__tests__/**',
    ]);
  });
});
