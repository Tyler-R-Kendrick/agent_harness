import { describe, expect, it, vi } from 'vitest';
import type { ToolSet } from 'ai';
import {
  callTool,
  callToolPlan,
  createStaticToolPlan,
  findTool,
  listTools,
  makeTool,
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
    });
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
