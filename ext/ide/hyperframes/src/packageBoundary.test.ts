import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_HYPERFRAMES_CONFIG,
  HYPERFRAMES_RENDERER,
  HyperframesEditorPane,
  HyperframesPreviewRenderer,
  createHyperframesArtifact,
  createHyperframesPlugin,
  createPreviewHtml,
} from './index.js';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(dirname(packageRoot)));
const packageJson = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
  exports: Record<string, string>;
  files: string[];
};

describe('hyperframes package boundary', () => {
  it('keeps package entry points and published artifact contents intentional', () => {
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

  it('documents stable imports and keeps source deep imports private', () => {
    const readme = readFileSync(join(packageRoot, 'README.md'), 'utf8');

    expect(readme).toContain("import { createHyperframesPlugin } from '@agent-harness/ext-hyperframes';");
    expect(readme).toContain("import manifest from '@agent-harness/ext-hyperframes/manifest';");
    expect(readme).toContain('Do not import from `@agent-harness/ext-hyperframes/src/*`');
    expect(readme).toContain('Published package contents');
  });

  it('exposes the documented root runtime API from the root entry point', async () => {
    const module = await import('./index.js');
    const packageRootRelative = relative(repositoryRoot, packageRoot).replaceAll('\\', '/');

    expect(Object.keys(module).sort()).toEqual([
      'DEFAULT_HYPERFRAMES_CONFIG',
      'HYPERFRAMES_RENDERER',
      'HyperframesEditorPane',
      'HyperframesPreviewRenderer',
      'createHyperframesArtifact',
      'createHyperframesPlugin',
      'createPreviewHtml',
    ]);
    expect(module).toMatchObject({
      DEFAULT_HYPERFRAMES_CONFIG,
      HYPERFRAMES_RENDERER,
      HyperframesEditorPane,
      HyperframesPreviewRenderer,
      createHyperframesArtifact,
      createHyperframesPlugin,
      createPreviewHtml,
    });
    expect(packageRootRelative).toBe('ext/ide/hyperframes');
  });
});
