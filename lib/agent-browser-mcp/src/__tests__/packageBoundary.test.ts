import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDir, '../..');
const srcRoot = path.join(packageRoot, 'src');

function collectTypeScriptFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : collectTypeScriptFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.ts') ? [entryPath] : [];
  });
}

describe('package boundaries', () => {
  it('uses webmcp through the workspace package entry point', () => {
    const imports = collectTypeScriptFiles(srcRoot).flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return Array.from(source.matchAll(/from\s+['"]([^'"]+)['"]/g), (match) => ({
        file: path.relative(packageRoot, file),
        specifier: match[1],
      }));
    });

    expect(imports.filter((item) => item.specifier.includes('../webmcp'))).toEqual([]);
    expect(imports.filter((item) => item.specifier === 'webmcp')).toEqual([]);
    expect(imports.some((item) => item.specifier === '@agent-harness/webmcp')).toBe(true);

    const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      files?: string[];
    };
    expect(packageJson.dependencies?.['@agent-harness/webmcp']).toBe('0.1.0');
    expect(packageJson.files).toEqual([
      'README.md',
      'src/**/*.ts',
      '!src/__tests__/**',
    ]);
  });
});
