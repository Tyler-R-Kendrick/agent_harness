import { describe, expect, it } from 'vitest';
import {
  STEERING_LABEL,
  buildSteeringOperatingInstructions,
  buildSteeringSystemPrompt,
  buildSteeringToolInstructions,
  isSteeringTaskText,
} from './index';

describe('Steering chat agent', () => {
  it('detects correction and steering-memory requests', () => {
    expect(isSteeringTaskText('Remember this correction: run the verifier before handoff')).toBe(true);
    expect(isSteeringTaskText('Add this to project steering memory')).toBe(true);
    expect(isSteeringTaskText('What is the weather today?')).toBe(false);
  });

  it('builds instructions for canonical .steering files', () => {
    const instructions = buildSteeringOperatingInstructions();

    expect(STEERING_LABEL).toBe('Steering');
    expect(instructions).toContain('.steering/STEERING.md');
    expect(instructions).toContain('.steering/user.steering.md');
    expect(instructions).toContain('Preserve exact correction text');
  });

  it('wraps workspace tool instructions with the Steering system prompt', () => {
    const prompt = buildSteeringSystemPrompt({ workspaceName: 'Research' });
    const toolPrompt = buildSteeringToolInstructions({
      workspaceName: 'Research',
      workspacePromptContext: '## Harness Steering\nFiles: 7',
      descriptors: [{
        id: 'workspace.write-file',
        label: 'Write file',
        description: 'Write a workspace file.',
      }],
      selectedToolIds: ['workspace.write-file'],
    });

    expect(prompt).toContain('Steering');
    expect(toolPrompt).toContain('## Harness Steering');
    expect(toolPrompt).toContain('workspace.write-file');
  });
});
