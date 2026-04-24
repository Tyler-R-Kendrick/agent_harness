import { describe, expect, it } from 'vitest';
import {
  buildAgentSystemPrompt,
  buildResearchTemplate,
  buildDelegationWorkerPrompt,
  buildDelegationWorkerTask,
  buildPersonaTemplate,
  composeAgentPrompt,
  buildToolInstructionsTemplate,
  buildToolRouterPrompt,
  resolveAgentScenario,
} from './agentPromptTemplates';

describe('agentPromptTemplates', () => {
  it('builds the collaborator persona template', () => {
    const template = buildPersonaTemplate();
    expect(template).toContain('Mirror the user\'s tone');
    expect(template).toContain('friendly, modest, and collaborative');
    expect(template).toContain('single most useful clarifying question');
    expect(template).toContain('collaborator');
    expect(template).toContain('uncertainty');
  });

  it('resolves prompt scenarios from user text', () => {
    expect(resolveAgentScenario('Please remember this and summarize it later.')).toBe('memory-recall');
    expect(resolveAgentScenario('Fix the failing vitest run and refactor the code.')).toBe('coding');
    expect(resolveAgentScenario('Switch the workspace in agent-browser terminal mode.')).toBe('harness-control');
    expect(resolveAgentScenario('Open the overlay for this tab and switch the panel.')).toBe('harness-control');
    expect(resolveAgentScenario('Research the current browser automation options with citations.')).toBe('research');
    expect(resolveAgentScenario('Hello there')).toBe('general-chat');
  });

  it('builds researcher guidance with provenance and persistence rules', () => {
    const template = buildResearchTemplate();
    expect(template).toContain('authoritative sources first');
    expect(template).toContain('provenance');
    expect(template).toContain('score source quality');
    expect(template).toContain('resolve conflicting information');
    expect(template).toContain('.research/<task-id>/research.md');

    const prompt = buildAgentSystemPrompt({
      workspaceName: 'Research',
      goal: 'Research browser automation options.',
      scenario: 'research',
    });

    expect(prompt).toContain('## Researcher Guidance');
    expect(prompt).toContain('Active workspace: Research');
    expect(prompt).toContain('Research browser automation options.');
  });

  it('builds tool instructions with available tool detail', () => {
    const prompt = buildToolInstructionsTemplate({
      workspaceName: 'Research',
      workspacePromptContext: 'Workspace instructions.',
      descriptors: [{ id: 'cli', label: 'CLI', description: 'Run commands.' }],
      selectedToolIds: ['cli'],
      selectedGroups: ['command-line'],
    });

    expect(prompt).toContain('## Tool Instructions');
    expect(prompt).toContain('Active workspace: Research');
    expect(prompt).toContain('Selected tool ids: cli');
    expect(prompt).toContain('Selected tool groups: command-line');
    expect(prompt).toContain('- cli (CLI) — Run commands. When to use:');
    expect(prompt).toContain('## Output Contract');
    expect(prompt).not.toContain('No tools selected');
  });

  it('composes agent prompts in a deterministic section order', () => {
    const prompt = composeAgentPrompt({
      persona: '## Persona\nOne',
      alignment: '## Alignment\nTwo',
      scenario: '## Scenario\nThree',
      toolInstructions: '## Tool Instructions\nFour',
    });

    expect(prompt).toBe('## Persona\nOne\n\n## Alignment\nTwo\n\n## Scenario\nThree\n\n## Tool Instructions\nFour');
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
    expect(assignmentPrompt).toContain('ownership boundaries');
    expect(assignmentPrompt).toContain('handoffs');

    const assignmentTask = buildDelegationWorkerTask({
      worker: 'assignment-agent',
      userPrompt: 'Find TODOs in src and delegate the work.',
      coordinatorProblem: 'Audit TODO coverage in src.',
    });

    expect(assignmentTask).toContain('Assigned task: assign each track to a specialist subagent');
    expect(assignmentTask).toContain('Original user request: Find TODOs in src and delegate the work.');
    expect(assignmentTask).toContain('Role: <specialist role> | Owns: <track and scope> | Handoff: <next role or deliverable>');
  });

  it('builds router prompts with alignment and explicit output contract', () => {
    const prompt = buildToolRouterPrompt({ workspaceName: 'Research', instructions: 'Base instructions.' });
    expect(prompt).toContain('Route the request to direct chat or tool use.');
    expect(prompt).toContain('{"mode":"tool-use"|"chat","goal":"<short goal>"}');
  });

  it('builds scenario-specific system prompts', () => {
    const prompt = buildAgentSystemPrompt({ workspaceName: 'Research', goal: 'Write code safely.', scenario: 'coding' });
    expect(prompt).toContain('## Coding Guidance');
    expect(prompt).toContain('## Goal');
    expect(prompt).toContain('Write code safely.');
  });
});
