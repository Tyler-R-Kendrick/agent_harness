import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageJsonPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../package.json',
);

describe('package metadata', () => {
  it('declares logact as a runtime dependency for consumer installs', () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      dependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies).toMatchObject({
      logact: '0.1.0',
    });
  });
});
