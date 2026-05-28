import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  DESIGN_MD_SUBSTITUTION_PLAN_SCHEMA,
  buildDesignMdGuidanceMessage,
  createCssDesignTokenApplyProvider,
  createDesignMdPlugin,
  createLlGuidanceDesignSubstitutionProvider,
  discoverDesignMdSemanticHooks,
  listDesignMdThemeOptions,
  renderDesignMdCss,
} from './index.js';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(dirname(packageRoot)));
const packageJson = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
  exports: Record<string, string>;
  files: string[];
};

describe('design.md package boundary', () => {
  it('keeps package entry points and published artifact contents intentional', () => {
    expect(packageJson.exports).toEqual({
      '.': './src/index.ts',
      './manifest': './agent-harness.plugin.json',
    });
    expect(packageJson.files).toEqual([
      'README.md',
      'agent-harness.plugin.json',
      'src/**/*.ts',
      'examples/**',
      '!src/**/*.test.ts',
      '!src/__tests__/**',
      '!examples/**/*.test.ts',
      '!examples/**/*.test.tsx',
      '!examples/**/__tests__/**',
    ]);
  });

  it('documents stable imports and keeps source deep imports private', () => {
    const readme = readFileSync(join(packageRoot, 'README.md'), 'utf8');

    expect(readme).toContain("import { createDesignMdPlugin } from '@agent-harness/ext-design-md';");
    expect(readme).toContain("import manifest from '@agent-harness/ext-design-md/manifest';");
    expect(readme).toContain('Do not import from `@agent-harness/ext-design-md/src/*`');
    expect(readme).toContain('Published package contents');
    expect(readme).toContain('Example implementation files are included, but example tests are excluded');
  });

  it('exposes the documented root runtime API from the root entry point', async () => {
    const module = await import('./index.js');
    const packageRootRelative = relative(repositoryRoot, packageRoot).replaceAll('\\', '/');

    expect(Object.keys(module).sort()).toEqual([
      'DESIGN_MD_SUBSTITUTION_PLAN_SCHEMA',
      'buildDesignMdGuidanceMessage',
      'createCssDesignTokenApplyProvider',
      'createDesignMdPlugin',
      'createLlGuidanceDesignSubstitutionProvider',
      'discoverDesignMdSemanticHooks',
      'listDesignMdThemeOptions',
      'renderDesignMdCss',
    ]);
    expect(module).toMatchObject({
      DESIGN_MD_SUBSTITUTION_PLAN_SCHEMA,
      buildDesignMdGuidanceMessage,
      createCssDesignTokenApplyProvider,
      createDesignMdPlugin,
      createLlGuidanceDesignSubstitutionProvider,
      discoverDesignMdSemanticHooks,
      listDesignMdThemeOptions,
      renderDesignMdCss,
    });
    expect(packageRootRelative).toBe('ext/ide/design-md');
  });
});
