import { describe, expect, it } from 'vitest';
import { createHarnessExtensionContext, type MemoryMessage } from 'harness-core';

import {
  buildAgentsMdPromptContext,
  createAgentsMdHookPlugin,
  detectAgentsMdFile,
  discoverAgentsMdFiles,
  validateAgentsMdFile,
} from './index.js';

describe('agents-md extension plugin', () => {
  it('discovers, validates, formats, and injects selected AGENTS.md assets', async () => {
    type Message = MemoryMessage & { role: 'system' | 'user' | 'assistant' };
    const files = [
      { path: 'AGENTS.md', content: '# Root\nUse TDD.' },
      { path: 'docs/AGENTS.md', content: '# Docs\nUse concise examples.' },
      { path: 'README.md', content: '# Readme' },
    ];
    const context = createHarnessExtensionContext<Message, { messages: Message[] }>();

    await context.plugins.load(createAgentsMdHookPlugin<Message>(files, {
      activeAgentPath: 'docs/AGENTS.md',
      priority: -5,
      role: 'system',
    }));

    const prepared = await context.hooks.runPipes('before-llm-messages', {
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(detectAgentsMdFile('AGENTS.md')).toBe(true);
    expect(detectAgentsMdFile('nested/AGENTS.md')).toBe(true);
    expect(detectAgentsMdFile('README.md')).toBe(false);
    expect(validateAgentsMdFile({ path: 'AGENTS.md', content: '' })).toBeNull();
    expect(validateAgentsMdFile({ path: 'README.md', content: '' })).toContain('AGENTS.md');
    expect(discoverAgentsMdFiles(files)).toEqual(files.slice(0, 2));
    expect(buildAgentsMdPromptContext(files, { activeAgentPath: 'docs/AGENTS.md' })).toContain('Active AGENTS.md:');
    expect(buildAgentsMdPromptContext([{ path: 'AGENTS.md', content: '# Root' }], { activeAgentPath: 'AGENTS.md' })).not.toContain('Other AGENTS.md files:');
    expect(buildAgentsMdPromptContext(files, { activeAgentPath: 'missing/AGENTS.md' })).toContain('AGENTS.md files:');
    expect(buildAgentsMdPromptContext([])).toBe('AGENTS.md files: none');
    expect(prepared.payload.messages[0]).toEqual(expect.objectContaining({
      role: 'system',
      content: expect.stringContaining('Use concise examples.'),
    }));
    expect(prepared.payload.messages[1]).toEqual({ role: 'user', content: 'hello' });
    expect(context.plugins.list().map((plugin) => plugin.id)).toEqual(['agents-md']);

    const defaultContext = createHarnessExtensionContext<Message, { messages: Message[] }>();
    await defaultContext.plugins.load(createAgentsMdHookPlugin<Message>(files));
    const defaultPrepared = await defaultContext.hooks.runPipes('before-llm-messages', {
      messages: [{ role: 'user', content: 'default options' }],
    });

    expect(defaultPrepared.payload.messages[0]).toEqual(expect.objectContaining({
      role: 'system',
      content: expect.stringContaining('AGENTS.md files:'),
    }));
  });
});
