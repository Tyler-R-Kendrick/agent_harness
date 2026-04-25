import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import * as publicApi from '@agent-harness/webmcp';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDir, '../..');

describe('package boundaries', () => {
  it('exposes the documented package entry point', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'MODEL_CONTEXT_PROMPT_REGISTRY_SYMBOL',
      'MODEL_CONTEXT_PROMPT_TEMPLATE_REGISTRY_SYMBOL',
      'MODEL_CONTEXT_REGISTRY_SYMBOL',
      'MODEL_CONTEXT_RESOURCE_REGISTRY_SYMBOL',
      'MODEL_CONTEXT_TOOL_NAME_PATTERN',
      'ModelContext',
      'ModelContextClient',
      'PromptRegistry',
      'PromptTemplateRegistry',
      'ResourceRegistry',
      'TOOL_ACTIVATED_EVENT',
      'TOOL_CANCELED_EVENT',
      'ToolRegistry',
      'dispatchToolActivated',
      'dispatchToolCanceled',
      'getModelContextPromptRegistry',
      'getModelContextPromptTemplateRegistry',
      'getModelContextRegistry',
      'getModelContextResourceRegistry',
      'installModelContext',
      'invokeModelContextTool',
    ]);
  });

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
