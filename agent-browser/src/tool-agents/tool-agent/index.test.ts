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

const artifactDescriptor: ToolDescriptor = {
  id: 'webmcp:create_artifact',
  label: 'Create artifact',
  description: 'Create a standalone artifact with one or more files mounted under //artifacts.',
  group: 'built-in',
  groupLabel: 'Built-In',
  subGroup: 'artifacts-mcp',
  subGroupLabel: 'Artifacts',
};

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

  it.each([
    ['PDF generation', 'create a PDF as an artifact about onboarding', 'pdf', ['document.pdf']],
    ['Image generation', 'generate an image as an artifact for a launch badge', 'image', ['image.svg']],
    ['Widget generation for the canvas widget feature', 'build a canvas widget artifact for project planning', 'canvas-widget', ['canvas-widget/widget.json', 'canvas-widget/index.html']],
    ['Design.md markdown file generation', 'write DESIGN.md as an artifact', 'design-md', ['DESIGN.md']],
    ['Agents.md markdown file generation', 'write AGENTS.md as an artifact', 'agents-md', ['AGENTS.md']],
    ['Agent skill generation', 'create an agent-skill artifact with a SKILL.md, references, scripts, and evals', 'agent-skill', ['skills/generated-skill/SKILL.md', 'skills/generated-skill/references/README.md', 'skills/generated-skill/scripts/verify.ts', 'skills/generated-skill/evals/evals.json']],
    ['DOCX generation', 'generate a DOCX artifact for the project brief', 'docx', ['document.docx']],
    ['PPTX generation', 'generate a PPTX artifact for the roadmap deck', 'pptx', ['deck.pptx']],
  ])('plans deterministic create_artifact execution for %s', (_name, goal, expectedKind, expectedPaths) => {
    const plan = createStaticToolPlan({
      tools: { [artifactDescriptor.id]: { execute: vi.fn() } } as unknown as ToolSet,
      descriptors: [...descriptors, artifactDescriptor],
    }, goal);

    expect(plan.selectedToolIds).toEqual(['webmcp:create_artifact']);
    expect(plan.steps).toEqual([
      expect.objectContaining({
        id: 'create-artifact',
        kind: 'call-tool',
        toolId: 'webmcp:create_artifact',
        saveAs: 'artifact',
      }),
    ]);
    const input = plan.steps[0]?.kind === 'call-tool' ? plan.steps[0].inputTemplate as {
      kind: string;
      files: Array<{ path: string; content: string }>;
    } : null;
    expect(input).toMatchObject({ kind: expectedKind });
    expect(input?.files.map((file) => file.path)).toEqual(expectedPaths);
    expect(JSON.stringify(input)).not.toContain('movie theaters');
  });

  it('executes the generated artifact plan through the selected create_artifact tool', async () => {
    const execute = vi.fn(async (input) => ({
      id: 'artifact-image-generated-image',
      title: 'Generated image',
      kind: 'image',
      files: (input as { files: unknown[] }).files,
      references: [],
    }));
    const artifactRuntime = {
      tools: { [artifactDescriptor.id]: { execute } } as unknown as ToolSet,
      descriptors: [...descriptors, artifactDescriptor],
    };
    const plan = createStaticToolPlan(artifactRuntime, 'create an image as an artifact');

    await expect(callToolPlan(artifactRuntime, plan)).resolves.toMatchObject({
      artifact: {
        output: {
          id: 'artifact-image-generated-image',
          files: [{ path: 'image.svg' }],
        },
      },
    });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'image',
      files: [expect.objectContaining({ path: 'image.svg', mediaType: 'image/svg+xml' })],
    }));
  });

  it('keeps nearby search planning relevant and does not route search prompts into artifacts', () => {
    const plan = createStaticToolPlan({
      tools: { [artifactDescriptor.id]: { execute: vi.fn() } } as unknown as ToolSet,
      descriptors: [
        ...descriptors,
        artifactDescriptor,
        {
          id: 'webmcp:search_web',
          label: 'Search web',
          description: 'Search the web for external facts and local recommendations.',
          group: 'built-in',
          groupLabel: 'Built-In',
          subGroup: 'web-search-mcp',
          subGroupLabel: 'Search',
        },
      ],
    }, "what're the best movie theaters near me?");

    expect(plan.selectedToolIds).toContain('webmcp:search_web');
    expect(plan.selectedToolIds).not.toContain('webmcp:create_artifact');
    expect(plan.steps).toEqual([]);
  });

  it('routes near-me web search through search tools and CLI fallback before eliciting the user', () => {
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
      {
        id: 'webmcp:search_web',
        label: 'Search web',
        description: 'Search the web for external facts and local restaurant results.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
      {
        id: 'webmcp:local_web_research',
        label: 'Local web research',
        description: 'Search local SearXNG for source-backed restaurant results.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
      {
        id: 'webmcp:read_web_page',
        label: 'Read web page',
        description: 'Read result pages and extract entity evidence.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
    ];

    const plan = createStaticToolPlan({
      tools: {},
      descriptors: userContextDescriptors,
    }, 'list restaurants near me');

    expect(plan.selectedToolIds).toEqual([
      'webmcp:recall_user_context',
      'webmcp:read_browser_location',
      'webmcp:search_web',
      'webmcp:local_web_research',
      'webmcp:read_web_page',
      'webmcp:elicit_user_input',
    ]);
    expect(plan.actorToolAssignments?.executor).toEqual(expect.arrayContaining([
      'webmcp:recall_user_context',
      'webmcp:read_browser_location',
      'webmcp:search_web',
      'webmcp:local_web_research',
      'webmcp:read_web_page',
      'webmcp:elicit_user_input',
    ]));
    expect(plan.actorToolAssignments?.['search-agent']).toEqual([
      'webmcp:search_web',
      'webmcp:local_web_research',
      'webmcp:read_web_page',
    ]);
    expect(plan.actorToolAssignments).not.toHaveProperty('rdf-web-search-agent');
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
