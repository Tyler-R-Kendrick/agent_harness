import { describe, expect, it, vi } from 'vitest';
import {
  SECURITY_REVIEW_LABEL,
  buildSecurityReviewOperatingInstructions,
  buildSecurityReviewSystemPrompt,
  buildSecurityReviewToolInstructions,
  isSecurityReviewTaskText,
  streamSecurityReviewChat,
} from './index';

vi.mock('@huggingface/transformers', () => ({
  TextStreamer: class MockTextStreamer {},
}));

describe('security review agent', () => {
  it('builds operating instructions for review and scheduled scans', () => {
    expect(SECURITY_REVIEW_LABEL).toBe('Security Review');
    const instructions = buildSecurityReviewOperatingInstructions();
    expect(instructions).toContain('auth regressions');
    expect(instructions).toContain('prompt injection');
    expect(instructions).toContain('severity-tagged findings');
    expect(instructions).toContain('remediation');
  });

  it('detects security tasks and builds tool-aware prompts', () => {
    expect(isSecurityReviewTaskText('Run a security review for this PR.')).toBe(true);
    expect(isSecurityReviewTaskText('Check for prompt injection and unsafe auto approvals.')).toBe(true);
    expect(isSecurityReviewTaskText('Write a product tour.')).toBe(false);

    const systemPrompt = buildSecurityReviewSystemPrompt({ workspaceName: 'Agent Browser' });
    expect(systemPrompt).toContain('Active workspace: Agent Browser');
    expect(systemPrompt).toContain('Security Review Operating Instructions');

    const toolPrompt = buildSecurityReviewToolInstructions({
      workspaceName: 'Agent Browser',
      workspacePromptContext: 'Workspace rules.',
      descriptors: [{ id: 'secret-scan', label: 'Secret scan', description: 'Scan for exposed secrets.' }],
      selectedToolIds: ['secret-scan'],
    });
    expect(toolPrompt).toContain('Selected tool ids: secret-scan');
    expect(toolPrompt).toContain('Scan for exposed secrets.');
  });

  it('requires a backing runtime before streaming', async () => {
    await expect(streamSecurityReviewChat({
      runtimeProvider: 'ghcp',
      workspaceName: 'Agent Browser',
      workspacePromptContext: '',
      messages: [],
      latestUserInput: 'security review this diff',
    }, {})).rejects.toThrow('Security Review GHCP chat requires a modelId and sessionId.');

    await expect(streamSecurityReviewChat({
      runtimeProvider: 'codi',
      workspaceName: 'Agent Browser',
      workspacePromptContext: '',
      messages: [],
      latestUserInput: 'security review this diff',
    }, {})).rejects.toThrow('Security Review Codi chat requires a local model.');
  });
});
