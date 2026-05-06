import { describe, expect, it } from 'vitest';
import { createHarnessExtensionContext, type MemoryMessage } from 'harness-core';

import {
  buildWorkflowMdPromptContext,
  createSymphonyPlugin,
  detectWorkflowMdFile,
  discoverWorkflowMdFiles,
  validateWorkflowMdFile,
} from './index.js';

describe('symphony extension plugin', () => {
  it('discovers, validates, formats, and injects selected WORKFLOW.md assets', async () => {
    type Message = MemoryMessage & { role: 'system' | 'user' | 'assistant' };
    const files = [
      { path: 'WORKFLOW.md', content: '# Release workflow\n1. Plan\n2. Test\n3. Review' },
      { path: 'docs/WORKFLOW.md', content: '# Docs workflow\nKeep docs and screenshots together.' },
      { path: 'README.md', content: '# Readme' },
    ];
    const context = createHarnessExtensionContext<Message, { messages: Message[] }>();

    await context.plugins.load(createSymphonyPlugin<Message>(files, {
      activeWorkflowPath: 'docs/WORKFLOW.md',
      priority: -8,
      role: 'system',
    }));

    const prepared = await context.hooks.runPipes('before-llm-messages', {
      messages: [{ role: 'user', content: 'ship it' }],
    });

    expect(detectWorkflowMdFile('WORKFLOW.md')).toBe(true);
    expect(detectWorkflowMdFile('nested/WORKFLOW.md')).toBe(true);
    expect(detectWorkflowMdFile('README.md')).toBe(false);
    expect(validateWorkflowMdFile({ path: 'WORKFLOW.md', content: '' })).toBeNull();
    expect(validateWorkflowMdFile({ path: 'README.md', content: '' })).toContain('WORKFLOW.md');
    expect(discoverWorkflowMdFiles(files)).toEqual(files.slice(0, 2));
    expect(buildWorkflowMdPromptContext(files, { activeWorkflowPath: 'docs/WORKFLOW.md' })).toContain('Active WORKFLOW.md:');
    expect(buildWorkflowMdPromptContext([{ path: 'WORKFLOW.md', content: '# Root' }], { activeWorkflowPath: 'WORKFLOW.md' })).not.toContain('Other WORKFLOW.md files:');
    expect(buildWorkflowMdPromptContext(files, { activeWorkflowPath: 'missing/WORKFLOW.md' })).toContain('WORKFLOW.md files:');
    expect(buildWorkflowMdPromptContext([])).toBe('WORKFLOW.md files: none');
    expect(prepared.payload.messages[0]).toEqual(expect.objectContaining({
      role: 'system',
      content: expect.stringContaining('Keep docs and screenshots together.'),
    }));
    expect(prepared.payload.messages[1]).toEqual({ role: 'user', content: 'ship it' });
    expect(prepared.outputs).toEqual([{
      hookId: 'symphony.workflow-md',
      output: { applied: true, workflowPaths: ['WORKFLOW.md', 'docs/WORKFLOW.md'] },
    }]);
    expect(context.plugins.list().map((plugin) => plugin.id)).toEqual(['symphony']);

    const defaultContext = createHarnessExtensionContext<Message, { messages: Message[] }>();
    await defaultContext.plugins.load(createSymphonyPlugin<Message>(files));
    const defaultPrepared = await defaultContext.hooks.runPipes('before-llm-messages', {
      messages: [{ role: 'user', content: 'default options' }],
    });

    expect(defaultPrepared.payload.messages[0]).toEqual(expect.objectContaining({
      role: 'system',
      content: expect.stringContaining('WORKFLOW.md files:'),
    }));
  });

  it('stays quiet when the default-loaded plugin has no WORKFLOW.md files', async () => {
    type Message = MemoryMessage & { role: 'system' | 'user' | 'assistant' };
    const context = createHarnessExtensionContext<Message, { messages: Message[] }>();

    await context.plugins.load(createSymphonyPlugin<Message>([
      { path: 'README.md', content: '# Project' },
    ]));

    await expect(context.hooks.runPipes('before-llm-messages', {
      messages: [{ role: 'user', content: 'plain request' }],
    })).resolves.toMatchObject({
      payload: {
        messages: [{ role: 'user', content: 'plain request' }],
      },
      outputs: [{
        hookId: 'symphony.workflow-md',
        output: { applied: false, reason: 'no-workflow-md-file' },
      }],
    });
  });
});
