import { describe, expect, it } from 'vitest';
import {
  buildAdversaryOperatingInstructions,
  buildAdversarySystemPrompt,
  buildAdversaryToolInstructions,
  isAdversaryTaskText,
} from './index';

describe('Adversary chat agent', () => {
  it('detects adversarial review requests', () => {
    expect(isAdversaryTaskText('Run an adversary pass against the candidate answer.')).toBe(true);
    expect(isAdversaryTaskText('Generate red-team candidate outputs for the judge.')).toBe(true);
    expect(isAdversaryTaskText('Summarize this README.')).toBe(false);
  });

  it('builds operating instructions for hidden adversarial candidate generation', () => {
    const instructions = buildAdversaryOperatingInstructions({ maxCandidates: 3 });

    expect(instructions).toContain('minimum of 1 candidate');
    expect(instructions).toContain('maximum of 3 candidates');
    expect(instructions).toContain('eval criteria');
    expect(instructions).toContain('AgentBus');
    expect(instructions).toContain('circular failures');
    expect(instructions).toContain('Do not reveal adversary identity to voters');
  });

  it('adds workspace and model context to the system prompt', () => {
    const prompt = buildAdversarySystemPrompt({
      workspaceName: 'Checkout',
      modelId: 'gpt-4.1',
      maxCandidates: 2,
    });

    expect(prompt).toContain('Checkout');
    expect(prompt).toContain('gpt-4.1');
    expect(prompt).toContain('maximum of 2 candidates');
    expect(prompt).toContain('happy-path outputs in parallel');
  });

  it('combines adversary and tool instructions', () => {
    const prompt = buildAdversaryToolInstructions({
      workspaceName: 'Checkout',
      workspacePromptContext: 'Eval criteria: reject invalid totals',
      descriptors: [{ id: 'read_file', label: 'Read file', description: 'Read workspace files' }],
      selectedToolIds: ['read_file'],
      selectedGroups: ['workspace'],
      maxCandidates: 4,
    });

    expect(prompt).toContain('Eval criteria: reject invalid totals');
    expect(prompt).toContain('Read file');
    expect(prompt).toContain('maximum of 4 candidates');
  });
});
