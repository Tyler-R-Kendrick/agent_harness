import { describe, expect, it } from 'vitest';
import {
  buildAgentSystemPrompt,
  buildInstructionFollowingTemplate,
  buildSelfReflectionTemplate,
  buildResearchTemplate,
  buildDelegationWorkerPrompt,
  buildDelegationWorkerTask,
  buildMemoryRecallTemplate,
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

  it('builds an explicit instruction-following contract for chat eval constraints', () => {
    const template = buildInstructionFollowingTemplate();

    expect(template).toContain('Honor explicit user constraints exactly');
    expect(template).toContain('format');
    expect(template).toContain('length');
    expect(template).toContain('punctuation');
    expect(template).toContain('casing');
    expect(template).toContain('JSON');
  });

  it('resolves prompt scenarios from user text', () => {
    expect(resolveAgentScenario('Please remember this and summarize it later.')).toBe('memory-recall');
    expect(resolveAgentScenario('Fix the failing vitest run and refactor the code.')).toBe('coding');
    expect(resolveAgentScenario('Switch the workspace in agent-browser terminal mode.')).toBe('harness-control');
    expect(resolveAgentScenario('Open the overlay for this tab and switch the panel.')).toBe('harness-control');
    expect(resolveAgentScenario('Research the current browser automation options with citations.')).toBe('research');
    expect(resolveAgentScenario('What are you best at as this workspace agent?')).toBe('self-reflection');
    expect(resolveAgentScenario('Which tools, hooks, and skills do you have registered?')).toBe('self-reflection');
    expect(resolveAgentScenario('What can you not do, and what is best left to a human?')).toBe('self-reflection');
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

  it('builds file-backed memory recall guidance', () => {
    const template = buildMemoryRecallTemplate();

    expect(template).toContain('Memory agent');
    expect(template).toContain('.memory/MEMORY.md');
    expect(template).toContain('.memory/*.memory.md');
    expect(template).toContain('markdown list item');
  });

  it('builds self-reflection guidance for agent identity, capability inventory, limits, and human handoff', () => {
    const template = buildSelfReflectionTemplate();

    expect(template).toContain('active workspace agent');
    expect(template).toContain('registered tools');
    expect(template).toContain('skills, plugins, hooks');
    expect(template).toContain('best for a human');
    expect(template).toContain('Do not invent unavailable tools');

    const prompt = buildAgentSystemPrompt({
      workspaceName: 'Research',
      goal: 'Answer questions about the active workspace agent.',
      scenario: 'self-reflection',
    });

    expect(prompt).toContain('## Self-Reflection Guidance');
    expect(prompt).toContain('Active workspace: Research');
    expect(prompt).toContain('Answer questions about the active workspace agent.');
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
    expect(prompt).toContain('## Instruction Following Contract');
    expect(prompt).toContain('## Goal');
    expect(prompt).toContain('Write code safely.');
  });

  it('adds on-demand sketch-of-thought expert prompts and model SAE metadata to expert scenarios', () => {
    const prompt = (buildAgentSystemPrompt as unknown as (input: {
      workspaceName: string;
      goal: string;
      scenario: 'research';
      modelId: string;
    }) => string)({
      workspaceName: 'Research',
      goal: 'Research supported sparse autoencoders.',
      scenario: 'research',
      modelId: 'Qwen/Qwen3.5-27B',
    });

    expect(prompt).toContain('## Sketch-of-Thought Expert Agent');
    expect(prompt).toContain('Expert Lexicons');
    expect(prompt).toContain('Research supported sparse autoencoders.');
    expect(prompt).toContain('No full-sentence chain-of-thought');
    expect(prompt).toContain('## SAE Mapping');
    expect(prompt).toContain('Qwen/SAE-Res-Qwen3.5-27B-W80K-L0_100');
  });
});
