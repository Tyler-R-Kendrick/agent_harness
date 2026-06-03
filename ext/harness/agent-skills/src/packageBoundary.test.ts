import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as publicApi from './index.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(path.join(packageRoot, relativePath), 'utf8'));
}

function readText(relativePath: string) {
  return readFileSync(path.join(packageRoot, relativePath), 'utf8');
}

describe('package boundary', () => {
  it('publishes the root plugin, manifest subpath, and example assets only', () => {
    const packageJson = readJson('package.json');

    expect(packageJson.exports).toEqual({
      '.': './src/index.ts',
      './manifest': './agent-harness.plugin.json',
    });
    expect(packageJson.files).toEqual([
      'README.md',
      'agent-harness.plugin.json',
      'src/**/*.ts',
      'examples/**',
      '!examples/**/*.test.ts',
      '!examples/**/__tests__/**',
      '!src/**/*.test.ts',
      '!src/__tests__/**',
    ]);
  });

  it('documents the stable imports, examples asset, and private source boundary', () => {
    const readme = readText('README.md');

    expect(readme).toContain("import { createAgentSkillsPlugin } from '@agent-harness/ext-agent-skills';");
    expect(readme).toContain("import manifest from '@agent-harness/ext-agent-skills/manifest';");
    expect(readme).toContain('examples/default-workspace-skills/');
    expect(readme).toContain('example validation tests are excluded from published package artifacts');
    expect(readme).toContain('Do not deep-import files under `src/`');
  });

  it('keeps the root runtime value API explicit', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'WORKSPACE_AGENT_SKILL_DIRECTORIES',
      'WORKSPACE_SKILL_DIRECTORIES',
      'createAgentSkillRegistry',
      'createAgentSkillsPlugin',
      'detectAgentSkillFile',
      'discoverAgentSkills',
      'executeCompositeSkill',
      'validateAgentSkillFile',
    ]);
  });
});
