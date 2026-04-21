import { describe, expect, it } from 'vitest';
import {
  buildAgentSystemPrompt,
  buildDelegationWorkerPrompt,
  buildDelegationWorkerTask,
  buildPersonaTemplate,
  buildToolInstructionsTemplate,
  buildToolRouterPrompt,
  resolveAgentScenario,
} from './agentPromptTemplates';

describe('agentPromptTemplates', () => {
  it('builds the collaborator persona template', () => {
    const template = buildPersonaTemplate();
    expect(template).toContain('Mirror the user\'s tone');
    expect(template).toContain('friendly, modest, and collaborative');
    expect(template).toContain('ask for clarifying direction');
  });

  it('resolves prompt scenarios from user text', () => {
    expect(resolveAgentScenario('Please remember this and summarize it later.')).toBe('memory-recall');
    expect(resolveAgentScenario('Fix the failing test and refactor the code.')).toBe('coding');
    expect(resolveAgentScenario('Switch the workspace in agent-browser terminal mode.')).toBe('harness-control');
    expect(resolveAgentScenario('Hello there')).toBe('general-chat');
  });

  it('builds tool instructions with available tool detail', () => {
    const prompt = buildToolInstructionsTemplate({
      workspaceName: 'Research',
      workspacePromptContext: 'Workspace instructions.',
      descriptors: [{ id: 'cli', label: 'CLI', description: 'Run commands.' }],
    });

    expect(prompt).toContain('## Tool Instructions');
    expect(prompt).toContain('Active workspace: Research');
    expect(prompt).toContain('- cli (CLI): Run commands.');
  });

  it('builds unique delegation prompts and assigned tasks per worker', () => {
    const breakdownPrompt = buildDelegationWorkerPrompt({ workspaceName: 'Research', worker: 'breakdown-agent' });
    const assignmentPrompt = buildDelegationWorkerPrompt({ workspaceName: 'Research', worker: 'assignment-agent' });
    const validationPrompt = buildDelegationWorkerPrompt({ workspaceName: 'Research', worker: 'validation-agent' });

    expect(breakdownPrompt).toContain('delegation-worker:breakdown-agent');
    expect(assignmentPrompt).toContain('delegation-worker:assignment-agent');
    expect(validationPrompt).toContain('delegation-worker:validation-agent');
    expect(breakdownPrompt).not.toEqual(assignmentPrompt);
    expect(assignmentPrompt).not.toEqual(validationPrompt);

    const assignmentTask = buildDelegationWorkerTask({
      worker: 'assignment-agent',
      userPrompt: 'Find TODOs in src and delegate the work.',
      coordinatorProblem: 'Audit TODO coverage in src.',
    });

    expect(assignmentTask).toContain('Assigned task: assign each track to a specialist subagent');
    expect(assignmentTask).toContain('Original user request: Find TODOs in src and delegate the work.');
  });

  it('builds router prompts with alignment and explicit output contract', () => {
    const prompt = buildToolRouterPrompt({ workspaceName: 'Research', instructions: 'Base instructions.' });
    expect(prompt).toContain('Route the request to direct chat or tool use.');
    expect(prompt).toContain('{"mode":"tool-use"|"chat","goal":"<short goal>"}');
  });

  it('builds scenario-specific system prompts', () => {
    const prompt = buildAgentSystemPrompt({ workspaceName: 'Research', goal: 'Write code safely.', scenario: 'coding' });
    expect(prompt).toContain('## Coding Guidance');
    expect(prompt).toContain('Primary goal: Write code safely.');
  });
});