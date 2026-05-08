import { describe, expect, it, vi } from 'vitest';
import {
  AGENT_SWARM_AGENT_ID,
  AGENT_SWARM_LABEL,
  buildAgentSwarmOperatingInstructions,
  buildAgentSwarmSystemPrompt,
  buildAgentSwarmToolInstructions,
  isAgentSwarmTaskText,
  streamAgentSwarmChat,
} from './index';
import { buildAgentSwarmPlan, DEFAULT_AGENT_SWARM_SETTINGS } from '../../services/agentSwarms';

vi.mock('@huggingface/transformers', () => ({
  TextStreamer: class MockTextStreamer {},
}));

describe('agent swarm chat agent', () => {
  it('builds first-class swarm instructions around persona-driven task completion', () => {
    const instructions = buildAgentSwarmOperatingInstructions();

    expect(AGENT_SWARM_AGENT_ID).toBe('swarm');
    expect(AGENT_SWARM_LABEL).toBe('Swarm');
    expect(instructions).toContain('# Swarm');
    expect(instructions).toContain('persona');
    expect(instructions).toContain('16-agent');
    expect(instructions).toContain('asset output');
    expect(instructions).toContain('verification');
  });

  it('detects swarm tasks and builds prompts with the active swarm plan', () => {
    expect(isAgentSwarmTaskText('Use a squad of parallel agents to build the asset pack.')).toBe(true);
    expect(isAgentSwarmTaskText('Run an agent swarm with reviewer personas.')).toBe(true);
    expect(isAgentSwarmTaskText('What time is it?')).toBe(false);

    const plan = buildAgentSwarmPlan({
      settings: {
        ...DEFAULT_AGENT_SWARM_SETTINGS,
        selectedTemplateId: 'asset-production',
        mode: 'expanded',
      },
      request: 'produce a design system asset pack',
    });

    const systemPrompt = buildAgentSwarmSystemPrompt({ workspaceName: 'Studio', plan });
    expect(systemPrompt).toContain('Active workspace: Studio');
    expect(systemPrompt).toContain('## Swarm Operating Instructions');
    expect(systemPrompt).toContain('## Agent Swarm');
    expect(systemPrompt).toContain('Asset production squad');
    expect(systemPrompt).toContain('Planned agents: 16');

    const toolPrompt = buildAgentSwarmToolInstructions({
      workspaceName: 'Studio',
      workspacePromptContext: 'Workspace rules.',
      descriptors: [{ id: 'files', label: 'Files', description: 'Write files.' }],
      selectedToolIds: ['files'],
      plan,
    });
    expect(toolPrompt).toContain('## Tool Instructions');
    expect(toolPrompt).toContain('Selected tool ids: files');
    expect(toolPrompt).toContain('Write files.');
    expect(toolPrompt).toContain('## Swarm Operating Instructions');
  });

  it('requires a backing runtime before streaming', async () => {
    await expect(streamAgentSwarmChat({
      runtimeProvider: 'ghcp',
      workspaceName: 'Studio',
      workspacePromptContext: '',
      messages: [],
      latestUserInput: 'run an agent swarm',
    }, {})).rejects.toThrow('Swarm GHCP chat requires a modelId and sessionId.');

    await expect(streamAgentSwarmChat({
      runtimeProvider: 'codi',
      workspaceName: 'Studio',
      workspacePromptContext: '',
      messages: [],
      latestUserInput: 'run an agent swarm',
    }, {})).rejects.toThrow('Swarm Codi chat requires a local model.');
  });
});
