import { describe, expect, it } from 'vitest';
import {
  CONTEXT_MANAGER_AGENT_ID,
  CONTEXT_MANAGER_LABEL,
  buildContextManagerOperatingInstructions,
  buildContextManagerSystemPrompt,
  buildContextManagerToolInstructions,
  isContextManagerTaskText,
} from './index';

describe('ContextManager chat agent', () => {
  it('identifies context-management tasks', () => {
    expect(CONTEXT_MANAGER_AGENT_ID).toBe('context-manager');
    expect(CONTEXT_MANAGER_LABEL).toBe('Context Manager');
    expect(isContextManagerTaskText('Monitor token usage and compact this chat context.')).toBe(true);
    expect(isContextManagerTaskText('Use caveman mode and keep large tool output out of the prompt.')).toBe(true);
    expect(isContextManagerTaskText('Say hello to the current page.')).toBe(false);
  });

  it('builds operating instructions for summaries, originals, and tool-output cache refs', () => {
    const instructions = buildContextManagerOperatingInstructions();

    expect(instructions).toContain('monitor token usage');
    expect(instructions).toContain('original messages');
    expect(instructions).toContain('tool-output cache refs');
    expect(instructions).toContain('caveman mode');
  });

  it('builds prompts that include workspace context and selected tools', () => {
    const systemPrompt = buildContextManagerSystemPrompt({
      workspaceName: 'Research',
      modelId: 'gpt-4.1',
    });
    const toolInstructions = buildContextManagerToolInstructions({
      workspaceName: 'Research',
      workspacePromptContext: '## Chaptered Session Context\nSummary: prior work',
      descriptors: [{ id: 'browser.open', label: 'Open', description: 'Open a URL' }],
      selectedToolIds: ['browser.open'],
      selectedGroups: ['browser'],
    });

    expect(systemPrompt).toContain('Research');
    expect(systemPrompt).toContain('gpt-4.1');
    expect(systemPrompt).toContain('Context Manager Operating Instructions');
    expect(toolInstructions).toContain('## Context Manager Artifacts');
    expect(toolInstructions).toContain('## Chaptered Session Context');
    expect(toolInstructions).toContain('browser.open');
  });
});
