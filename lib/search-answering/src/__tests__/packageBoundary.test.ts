import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import packageJson from '../../package.json' with { type: 'json' };
import * as publicApi from '../index';

describe('package boundary', () => {
  it('documents and protects the stable root package surface', async () => {
    expect(packageJson.name).toBe('@agent-harness/search-answering');
    expect(packageJson.main).toBe('./src/index.ts');
    expect(packageJson.types).toBe('./src/index.ts');
    expect(packageJson.exports).toEqual({
      '.': './src/index.ts',
    });
    expect(packageJson.files).toEqual([
      'README.md',
      'src/**/*.ts',
      '!src/**/*.test.ts',
      '!src/__tests__/**',
    ]);

    const readme = await readFile(join(process.cwd(), 'README.md'), 'utf8');
    expect(readme).toContain('## Package Boundary');
    expect(readme).toContain('@agent-harness/search-answering');
    expect(readme).toContain('@agent-harness/search-answering/src/*');
    expect(readme).toContain('README.md, package.json, and runtime source files');
  });

  it('keeps the root entry point explicit and intentional', () => {
    expect(publicApi).toEqual(expect.objectContaining({
      canAnswerFromSourceResults: expect.any(Function),
      composeSourceResultAnswer: expect.any(Function),
      formatUnavailableSearchMessage: expect.any(Function),
      isDirectSourceSearchIntent: expect.any(Function),
    }));
    expect(Object.keys(publicApi).sort()).toEqual([
      'canAnswerFromSourceResults',
      'composeSourceResultAnswer',
      'formatUnavailableSearchMessage',
      'isDirectSourceSearchIntent',
    ]);
  });
});
