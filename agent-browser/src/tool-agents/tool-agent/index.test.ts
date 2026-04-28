import { describe, expect, it, vi } from 'vitest';
import type { ToolSet } from 'ai';
import {
  callTool,
  callToolPlan,
  createToolAgentTools,
  createStaticToolPlan,
  findTool,
  listTools,
  makeTool,
  runToolPlanningAgent,
  type ToolAgentRuntime,
  type ToolPlan,
} from '.';
import type { ToolDescriptor } from '../../tools';

const descriptors: ToolDescriptor[] = [
  {
    id: 'cli',
    label: 'CLI',
    description: 'Run shell commands.',
    group: 'built-in',
    groupLabel: 'Built-In',
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

function runtime(tools: ToolSet = {} as ToolSet): ToolAgentRuntime {
  return { tools, descriptors };
}

describe('Tool Agent', () => {
  it('lists allowed built-in and generated descriptors', () => {
    expect(listTools({
      ...runtime(),
      generatedDescriptors: [{
        id: 'generated',
        label: 'Generated',
        description: 'Generated tool.',
        group: 'built-in',
        groupLabel: 'Built-In',
      }],
    }).map((descriptor) => descriptor.id)).toEqual(['cli', 'read_session_file', 'generated']);
  });

  it('finds and ranks tools by query', () => {
    expect(findTool(runtime(), 'session file').map((descriptor) => descriptor.id)).toEqual(['read_session_file']);
  });

  it('creates a static plan with selected tool ids', () => {
    const plan = createStaticToolPlan(runtime(), 'read the session file');
    expect(plan).toMatchObject({
      version: 1,
      goal: 'read the session file',
      selectedToolIds: ['read_session_file'],
      steps: [],
      createdToolFiles: [],
      actorToolAssignments: {
        'student-driver': [],
        'voter:teacher': [],
        'adversary-driver': [],
        'judge-decider': [],
        executor: ['read_session_file'],
      },
    });
  });

  it('prefers user-context tools over cli for restaurant near-me prompts', () => {
    const userContextDescriptors: ToolDescriptor[] = [
      descriptors[0],
      {
        id: 'webmcp:elicit_user_input',
        label: 'Elicit user input',
        description: 'Ask for missing city or neighborhood for restaurant near-me tasks.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'user-context-mcp',
        subGroupLabel: 'User Context',
      },
      {
        id: 'webmcp:read_browser_location',
        label: 'Read browser location',
        description: 'Read browser geolocation for restaurant near-me tasks.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'user-context-mcp',
        subGroupLabel: 'User Context',
      },
      {
        id: 'webmcp:recall_user_context',
        label: 'Recall user context',
        description: 'Search app memory for location context before restaurant near-me tasks.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'user-context-mcp',
        subGroupLabel: 'User Context',
      },
    ];

    const plan = createStaticToolPlan({
      tools: {},
      descriptors: userContextDescriptors,
    }, 'list restaurants near me');

    expect(plan.selectedToolIds.slice(0, 3)).toEqual([
      'webmcp:recall_user_context',
      'webmcp:read_browser_location',
      'webmcp:elicit_user_input',
    ]);
    expect(plan.actorToolAssignments?.executor).toEqual(expect.arrayContaining([
      'webmcp:recall_user_context',
      'webmcp:read_browser_location',
      'webmcp:elicit_user_input',
    ]));
    expect(plan.actorToolAssignments?.executor).not.toContain('cli');
  });

  it('exposes planning-only tools to the tool agent', () => {
    const tools = createToolAgentTools(runtime());

    expect(Object.keys(tools).sort()).toEqual([
      'find-tool',
      'list-tools',
      'plan-tools',
    ]);
    expect(tools).not.toHaveProperty('call-tool');
    expect(tools).not.toHaveProperty('call-tool-plan');
    expect(tools).not.toHaveProperty('codemode');
    expect(tools).not.toHaveProperty('make-tool');
  });

  it('plans tool assignments without executing CodeMode or workspace tools', async () => {
    const executeCode = vi.fn();
    const onToolAgentEvent = vi.fn();

    const planned = await runToolPlanningAgent({
      model: {} as never,
      messages: [{ role: 'user', content: 'read the session file' }],
      instructions: 'Plan tool access only.',
      runtime: {
        ...runtime({ read_session_file: { execute: vi.fn() } } as unknown as ToolSet),
        codeMode: { executeCode },
      },
    }, { onToolAgentEvent });

    expect(executeCode).not.toHaveBeenCalled();
    expect(planned.plan.actorToolAssignments?.executor).toEqual(['read_session_file']);
    expect(onToolAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'plan',
      branchId: 'tool-agent',
    }));
    expect(onToolAgentEvent).not.toHaveBeenCalledWith(expect.objectContaining({
      branchId: 'codemode',
    }));
  });

  it('calls one tool by id', async () => {
    const execute = vi.fn(async ({ value }) => `echo:${value}`);
    await expect(callTool(runtime({ echo: { execute } } as unknown as ToolSet), 'echo', { value: 'hi' }))
      .resolves.toBe('echo:hi');
    expect(execute).toHaveBeenCalledWith({ value: 'hi' });
  });

  it('executes serialized ToolPlans with chained outputs and nested plans', async () => {
    const tools = {
      first: { execute: vi.fn(async () => 'alpha') },
      second: { execute: vi.fn(async ({ text }) => `${text}:beta`) },
    } as unknown as ToolSet;
    const plan: ToolPlan = {
      version: 1,
      goal: 'chain tools',
      selectedToolIds: ['first', 'second'],
      createdToolFiles: [],
      steps: [
        { id: 'a', kind: 'call-tool', toolId: 'first', inputTemplate: {} },
        {
          id: 'nested',
          kind: 'call-tool-plan',
          plan: {
            version: 1,
            goal: 'nested',
            selectedToolIds: ['second'],
            createdToolFiles: [],
            steps: [
              { id: 'b', kind: 'call-tool', toolId: 'second', inputTemplate: { text: '{{steps.a.output}}' } },
            ],
          },
        },
      ],
    };

    const outputs = await callToolPlan(runtime(tools), plan);
    expect(outputs.a.output).toBe('alpha');
    expect(outputs.nested.output).toEqual({ b: { output: 'alpha:beta' } });
  });

  it('make-tool writes a durable workspace source file and emits branch events', async () => {
    const writeToolSource = vi.fn();
    const onToolAgentEvent = vi.fn();
    const generated = await makeTool({
      ...runtime(),
      workspace: { writeToolSource },
    }, {
      id: 'Summarize Tool',
      label: 'Summarize Tool',
      description: 'Summarize text.',
    }, { onToolAgentEvent });

    expect(generated.path).toBe('/workspace/.agent-browser/tools/summarize-tool.tool.ts');
    expect(generated.source).toContain('export async function execute');
    expect(writeToolSource).toHaveBeenCalledWith(generated);
    expect(onToolAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'tool-created',
      branchId: 'make-tool:summarize-tool',
      parentBranchId: 'codemode',
    }));
  });
});
