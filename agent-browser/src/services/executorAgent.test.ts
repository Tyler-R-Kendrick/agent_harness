import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolSet } from 'ai';
import { runConfiguredExecutorAgent } from './executorAgent';
import type { LogActActorExecuteContext } from './logactActorWorkflow';
import type { ToolDescriptor } from '../tools';
import type { ToolAgentRuntime, ToolPlan } from '../tool-agents/tool-agent';

const runToolAgentMock = vi.fn();
const runLocalToolCallExecutorMock = vi.fn();

vi.mock('./agentRunner', () => ({
  runToolAgent: (options: unknown, callbacks: unknown) => runToolAgentMock(options, callbacks),
}));

vi.mock('./localToolCallExecutor', () => ({
  runLocalToolCallExecutor: (options: unknown, callbacks: unknown) =>
    runLocalToolCallExecutorMock(options, callbacks),
}));

const descriptor: ToolDescriptor = {
  id: 'read_session_file',
  label: 'Read session file',
  description: 'Read a workspace file.',
  group: 'built-in',
  groupLabel: 'Built-In',
};

const plan: ToolPlan = {
  version: 1,
  goal: 'Inspect AGENTS.md',
  selectedToolIds: ['read_session_file'],
  steps: [],
  createdToolFiles: [],
  actorToolAssignments: {
    executor: ['read_session_file'],
  },
};

const executeContext: LogActActorExecuteContext = {
  action: 'Committed LogAct plan: read AGENTS.md and summarize the instruction constraints.',
  toolPolicy: {
    allowedToolIds: ['read_session_file'],
    assignments: { executor: ['read_session_file'] },
  },
  plan,
  selectedDescriptors: [descriptor],
  selectedTools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
  bus: {} as LogActActorExecuteContext['bus'],
  busEntries: [{
    id: 'bus-7',
    position: 7,
    realtimeTs: 1,
    payloadType: 'Vote',
    summary: 'Vote · voter:teacher ✓',
    detail: 'Teacher approved the student candidate.',
    actorId: 'voter:teacher',
    branchId: 'agent:judge-decider',
  }],
};

function baseOptions() {
  return {
    model: { provider: 'test', modelId: 'model' } as never,
    tools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
    toolDescriptors: [descriptor],
    instructions: 'Workspace instructions.',
    messages: [{ role: 'user' as const, content: 'Raw prompt only.' }],
    workspaceName: 'Research',
    capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
    runtime: {} as ToolAgentRuntime,
  };
}

describe('runConfiguredExecutorAgent', () => {
  beforeEach(() => {
    runToolAgentMock.mockReset();
    runLocalToolCallExecutorMock.mockReset();
  });

  it('uses the committed AgentBus execution plan as the executor prompt', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'done', steps: 1 });

    await (runConfiguredExecutorAgent as (...args: unknown[]) => Promise<unknown>)(
      baseOptions(),
      plan,
      [descriptor],
      { read_session_file: { execute: vi.fn() } },
      {},
      executeContext,
    );

    const runOptions = runToolAgentMock.mock.calls[0][0];
    const promptText = [
      runOptions.instructions,
      ...runOptions.messages.map((message: { content: string }) => message.content),
    ].join('\n');
    expect(promptText).toContain('Committed LogAct plan: read AGENTS.md');
    expect(promptText).toContain('Teacher approved the student candidate.');
    expect(promptText).toContain('Allowed tools: read_session_file');
    expect(runOptions.messages).not.toEqual([{ role: 'user', content: 'Raw prompt only.' }]);
  });

  it('returns a failed executor result when any tool result is an error', async () => {
    runToolAgentMock.mockImplementation(async (_options, callbacks) => {
      callbacks.onToolResult?.('read_session_file', { path: 'AGENTS.md' }, 'permission denied', true, 'tool-1');
      return { text: 'could not inspect the file', steps: 1 };
    });

    const result = await (runConfiguredExecutorAgent as (...args: unknown[]) => Promise<unknown>)(
      baseOptions(),
      plan,
      [descriptor],
      { read_session_file: { execute: vi.fn() } },
      {},
      executeContext,
    );

    expect(result).toMatchObject({
      text: 'could not inspect the file',
      steps: 1,
      failed: true,
      error: 'read_session_file: permission denied',
    });
  });

  it('pauses location-dependent execution with user elicitation after memory and browser location are unavailable', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'model should not run before elicitation', steps: 1 });
    const toolCalls: string[] = [];
    const toolResults: Array<{ toolName: string; result: unknown; isError: boolean }> = [];
    const userContextDescriptors: ToolDescriptor[] = [
      {
        id: 'webmcp:recall_user_context',
        label: 'Recall user context',
        description: 'Search app memory for saved city, neighborhood, or location.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'user-context-mcp',
        subGroupLabel: 'User Context',
      },
      {
        id: 'webmcp:read_browser_location',
        label: 'Read browser location',
        description: 'Read browser geolocation before asking the user.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'user-context-mcp',
        subGroupLabel: 'User Context',
      },
      {
        id: 'webmcp:elicit_user_input',
        label: 'Elicit user input',
        description: 'Ask the user for missing location data before execution.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'user-context-mcp',
        subGroupLabel: 'User Context',
      },
    ];
    const userContextPlan: ToolPlan = {
      version: 1,
      goal: 'List restaurants near me',
      selectedToolIds: userContextDescriptors.map((toolDescriptor) => toolDescriptor.id),
      steps: [],
      createdToolFiles: [],
      actorToolAssignments: {
        executor: userContextDescriptors.map((toolDescriptor) => toolDescriptor.id),
      },
    };
    const runtime: ToolAgentRuntime = {
      tools: {
        'webmcp:recall_user_context': {
          execute: vi.fn(async () => ({ status: 'empty', query: 'location', memories: [] })),
        },
        'webmcp:read_browser_location': {
          execute: vi.fn(async () => ({
            status: 'denied',
            reason: 'Browser location permission was denied.',
          })),
        },
        'webmcp:elicit_user_input': {
          execute: vi.fn(async () => ({
            status: 'needs_user_input',
            requestId: 'elicitation-1',
            prompt: 'What city or neighborhood should I use to list restaurants near you?',
            fields: [{ id: 'location', label: 'City or neighborhood', required: true }],
          })),
        },
        cli: { execute: vi.fn() },
      } as unknown as ToolSet,
      descriptors: [
        ...userContextDescriptors,
        {
          id: 'cli',
          label: 'CLI',
          description: 'Run shell commands.',
          group: 'built-in',
          groupLabel: 'Built-In',
        },
      ],
    };

    const result = await runConfiguredExecutorAgent({
      ...baseOptions(),
      messages: [{ role: 'user' as const, content: 'list restaurants near me' }],
      runtime,
    }, userContextPlan, userContextDescriptors, runtime.tools, {
      onToolCall: (toolName) => toolCalls.push(toolName),
      onToolResult: (toolName, _args, toolResult, isError) => {
        toolResults.push({ toolName, result: toolResult, isError });
      },
    }, {
      ...executeContext,
      action: 'Use AgentBus instructions to list restaurants near me after resolving the user location.',
      toolPolicy: {
        allowedToolIds: userContextDescriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: userContextDescriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });

    expect(toolCalls).toEqual([
      'webmcp:recall_user_context',
      'webmcp:read_browser_location',
      'webmcp:elicit_user_input',
    ]);
    expect(toolResults.map(({ toolName }) => toolName)).toEqual(toolCalls);
    expect(toolResults.every(({ isError }) => !isError)).toBe(true);
    expect(runtime.tools.cli.execute).not.toHaveBeenCalled();
    expect(runToolAgentMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      blocked: true,
      needsUserInput: true,
      text: 'What city or neighborhood should I use to list restaurants near you?',
      steps: 3,
    });
    expect(result.failed).toBeUndefined();
  });
});
