import { describe, expect, it, vi } from 'vitest';
import {
  buildDebuggerOperatingInstructions,
  buildDebuggerSystemPrompt,
  buildDebuggerToolInstructions,
  isDebuggingTaskText,
  streamDebuggerChat,
} from './index';

vi.mock('@huggingface/transformers', () => ({
  TextStreamer: class MockTextStreamer {},
}));

describe('debugger', () => {
  it('builds first-class Debugger operating instructions', () => {
    const instructions = buildDebuggerOperatingInstructions();

    expect(instructions).toContain('# Debugger');
    expect(instructions).toContain('root-cause analysis');
    expect(instructions).toContain('hypotheses');
    expect(instructions).toContain('mitigation');
    expect(instructions).toContain('verification');
    expect(instructions).toContain('Do not collapse correlation into causation');
  });

  it('detects debugging tasks and builds Debugger prompts for chat and tools', () => {
    expect(isDebuggingTaskText('Debug why checkout fails after login.')).toBe(true);
    expect(isDebuggingTaskText('Please do root cause analysis for this incident.')).toBe(true);
    expect(isDebuggingTaskText('Say hello.')).toBe(false);

    const systemPrompt = buildDebuggerSystemPrompt({ workspaceName: 'Ops' });
    expect(systemPrompt).toContain('Active workspace: Ops');
    expect(systemPrompt).toContain('## Debugger Operating Instructions');
    expect(systemPrompt).toContain('hypothesis ledger');

    const toolPrompt = buildDebuggerToolInstructions({
      workspaceName: 'Ops',
      workspacePromptContext: 'Workspace rules.',
      descriptors: [{ id: 'cli', label: 'CLI', description: 'Run commands.' }],
      selectedToolIds: ['cli'],
    });
    expect(toolPrompt).toContain('## Tool Instructions');
    expect(toolPrompt).toContain('Selected tool ids: cli');
    expect(toolPrompt).toContain('Run commands.');
    expect(toolPrompt).toContain('## Debugger Operating Instructions');
  });

  it('requires a backing runtime before streaming', async () => {
    await expect(streamDebuggerChat({
      runtimeProvider: 'ghcp',
      workspaceName: 'Ops',
      workspacePromptContext: '',
      messages: [],
      latestUserInput: 'debug this failure',
    }, {})).rejects.toThrow('Debugger GHCP chat requires a modelId and sessionId.');

    await expect(streamDebuggerChat({
      runtimeProvider: 'codi',
      workspaceName: 'Ops',
      workspacePromptContext: '',
      messages: [],
      latestUserInput: 'debug this failure',
    }, {})).rejects.toThrow('Debugger Codi chat requires a local model.');
  });
});
