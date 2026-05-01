import { describe, expect, it } from 'vitest';
import type { ToolDescriptor } from '../tools';
import {
  buildWorkspaceSelfReflectionAnswer,
  evaluateSelfReflectionAnswer,
  extractWorkspaceSelfReflectionInventory,
  isSelfReflectionTaskText,
} from './selfReflection';

const SAMPLE_WORKSPACE_CONTEXT = [
  'Workspace capability files loaded from browser storage:',
  'Active AGENTS.md:',
  '- AGENTS.md',
  '# Workspace agent instructions',
  'Use TDD, verify work, and keep changes focused.',
  '',
  'Skills:',
  '- memory (.agents/skills/memory/SKILL.md): Recall and store durable workspace memory.',
  '- create-agent-eval (.agents/skills/create-agent-eval/SKILL.md): Create repeatable AgentEvals suites.',
  '',
  'Tools:',
  '- review-pr (.agents/tools/review-pr/tool.json)',
  '',
  'Plugins:',
  '- review-tools (.agents/plugins/review-tools/plugin.yaml)',
  '',
  'Hooks:',
  '- pre-task.sh (.agents/hooks/pre-task.sh)',
].join('\n');

const TOOL_DESCRIPTORS: ToolDescriptor[] = [
  {
    id: 'cli',
    label: 'CLI',
    description: 'Run shell commands in the active workspace terminal session.',
    group: 'built-in',
    groupLabel: 'Built-In',
  },
  {
    id: 'webmcp:local_web_research',
    label: 'Local web research',
    description: 'Search local SearXNG, extract pages, rank evidence, and return citations.',
    group: 'web-search-mcp',
    groupLabel: 'Web Search',
  },
  {
    id: 'read_session_file',
    label: 'Read session file',
    description: 'Read a file from the active session filesystem.',
    group: 'built-in',
    groupLabel: 'Built-In',
    subGroup: 'files-worktree-mcp',
    subGroupLabel: 'Files',
  },
];

describe('selfReflection', () => {
  it('detects self-reflection requests without stealing ordinary work requests', () => {
    expect(isSelfReflectionTaskText('What are you best at?')).toBe(true);
    expect(isSelfReflectionTaskText('Which tools/hooks/etc do you have registered?')).toBe(true);
    expect(isSelfReflectionTaskText('What can you not do, and what is best for a human?')).toBe(true);
    expect(isSelfReflectionTaskText('Describe the workspace agent capabilities.')).toBe(true);

    expect(isSelfReflectionTaskText('Fix your failing tests and run vitest.')).toBe(false);
    expect(isSelfReflectionTaskText('Research current browser automation options with citations.')).toBe(false);
  });

  it('extracts capability inventory from the workspace prompt context', () => {
    const inventory = extractWorkspaceSelfReflectionInventory(SAMPLE_WORKSPACE_CONTEXT);

    expect(inventory.agents).toEqual(expect.arrayContaining(['AGENTS.md']));
    expect(inventory.skills).toEqual(expect.arrayContaining([
      'memory (.agents/skills/memory/SKILL.md): Recall and store durable workspace memory.',
      'create-agent-eval (.agents/skills/create-agent-eval/SKILL.md): Create repeatable AgentEvals suites.',
    ]));
    expect(inventory.tools).toEqual(['review-pr (.agents/tools/review-pr/tool.json)']);
    expect(inventory.plugins).toEqual(['review-tools (.agents/plugins/review-tools/plugin.yaml)']);
    expect(inventory.hooks).toEqual(['pre-task.sh (.agents/hooks/pre-task.sh)']);
  });

  it('answers with strengths, registered tools, workspace capabilities, limits, and human responsibilities', () => {
    const answer = buildWorkspaceSelfReflectionAnswer({
      task: 'What are you best at, and which tools and hooks do you have registered?',
      workspaceName: 'Research',
      workspacePromptContext: SAMPLE_WORKSPACE_CONTEXT,
      toolDescriptors: TOOL_DESCRIPTORS,
    });

    expect(answer).toContain('active workspace agent for Research');
    expect(answer).toContain('Best at:');
    expect(answer).toContain('Registered runtime tools:');
    expect(answer).toContain('cli (CLI)');
    expect(answer).toContain('webmcp:local_web_research (Local web research)');
    expect(answer).toContain('read_session_file (Read session file)');
    expect(answer).toContain('Registered workspace capabilities:');
    expect(answer).toContain('memory (.agents/skills/memory/SKILL.md)');
    expect(answer).toContain('review-pr (.agents/tools/review-pr/tool.json)');
    expect(answer).toContain('review-tools (.agents/plugins/review-tools/plugin.yaml)');
    expect(answer).toContain('pre-task.sh (.agents/hooks/pre-task.sh)');
    expect(answer).toContain('Limitations:');
    expect(answer).toContain('Best for a human:');
    expect(answer).not.toMatch(/do anything|access every file|omniscient|guarantee success/i);
  });

  it('stays honest when no tools or workspace capabilities are registered', () => {
    const answer = buildWorkspaceSelfReflectionAnswer({
      task: 'What tools do you have?',
      workspaceName: 'Empty',
      workspacePromptContext: 'No workspace capability files are currently stored.',
      toolDescriptors: [],
    });

    expect(answer).toContain('active workspace agent for Empty');
    expect(answer).toContain('No runtime tools are currently selected');
    expect(answer).toContain('No workspace skills, tools, plugins, or hooks are currently registered');
    expect(answer).not.toContain('cli (CLI)');
    expect(answer).not.toContain('webmcp:local_web_research');
  });

  it('scores complete answers and rejects overclaimed self-descriptions', () => {
    const answer = buildWorkspaceSelfReflectionAnswer({
      task: 'What are your capabilities and limits?',
      workspaceName: 'Research',
      workspacePromptContext: SAMPLE_WORKSPACE_CONTEXT,
      toolDescriptors: TOOL_DESCRIPTORS,
    });

    const passing = evaluateSelfReflectionAnswer({
      task: 'What are your capabilities and limits?',
      answer,
      workspacePromptContext: SAMPLE_WORKSPACE_CONTEXT,
      toolDescriptors: TOOL_DESCRIPTORS,
    });

    expect(passing.passed).toBe(true);
    expect(passing.score).toBe(1);

    const failing = evaluateSelfReflectionAnswer({
      task: 'What can you do?',
      answer: 'I can do anything, access every file on your machine, and guarantee the work is correct.',
      workspacePromptContext: SAMPLE_WORKSPACE_CONTEXT,
      toolDescriptors: TOOL_DESCRIPTORS,
    });

    expect(failing.passed).toBe(false);
    expect(failing.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.name)).toEqual(expect.arrayContaining([
      'states-limitations',
      'avoids-overclaiming-access',
      'mentions-runtime-tools',
    ]));
  });
});
