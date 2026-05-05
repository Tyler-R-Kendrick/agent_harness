import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolSet } from 'ai';
import { PayloadType, type Payload } from 'logact';
import { runConfiguredExecutorAgent } from './executorAgent';
import { isGenericNonEntityLabel } from './executionRequirements';
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

  it('does not reject valid entity names that contain generic words as part of a brand name', () => {
    expect(isGenericNonEntityLabel('Half Price Books Palatine', 'bookstores')).toBe(false);
    expect(isGenericNonEntityLabel('Cities Movie Times', 'theaters')).toBe(true);
    expect(isGenericNonEntityLabel('States Movie Times', 'theaters')).toBe(true);
    expect(isGenericNonEntityLabel('Zip Codes Movie Times', 'theaters')).toBe(true);
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

  it('summarizes deterministic artifact plan outputs with //artifacts locations', async () => {
    const artifactDescriptor: ToolDescriptor = {
      id: 'webmcp:create_artifact',
      label: 'Create artifact',
      description: 'Create a standalone artifact with one or more files mounted under //artifacts.',
      group: 'built-in',
      groupLabel: 'Built-In',
      subGroup: 'artifacts-mcp',
      subGroupLabel: 'Artifacts',
    };
    const createArtifact = vi.fn(async () => ({
      id: 'artifact-image-launch-badge',
      title: 'Launch badge',
      kind: 'image',
      files: [{ path: 'image.svg', content: '<svg />', mediaType: 'image/svg+xml' }],
      references: [],
    }));
    const artifactPlan: ToolPlan = {
      version: 1,
      goal: 'create an image as an artifact',
      selectedToolIds: ['webmcp:create_artifact'],
      createdToolFiles: [],
      steps: [{
        id: 'create-artifact',
        kind: 'call-tool',
        toolId: 'webmcp:create_artifact',
        inputTemplate: {
          title: 'Launch badge',
          kind: 'image',
          files: [{ path: 'image.svg', content: '<svg />', mediaType: 'image/svg+xml' }],
        },
        saveAs: 'artifact',
      }],
    };
    const onDone = vi.fn();

    const result = await runConfiguredExecutorAgent({
      ...baseOptions(),
      tools: { 'webmcp:create_artifact': { execute: createArtifact } } as unknown as ToolSet,
      toolDescriptors: [artifactDescriptor],
      runtime: {
        tools: { 'webmcp:create_artifact': { execute: createArtifact } } as unknown as ToolSet,
        descriptors: [artifactDescriptor],
      },
    }, artifactPlan, [artifactDescriptor], { 'webmcp:create_artifact': { execute: createArtifact } } as unknown as ToolSet, { onDone });

    expect(result).toMatchObject({
      text: expect.stringContaining('Created artifact Launch badge at //artifacts/artifact-image-launch-badge.'),
      steps: 1,
    });
    expect(result.text).toContain('//artifacts/artifact-image-launch-badge/image.svg');
    expect(onDone).toHaveBeenCalledWith(result.text);
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
          execute: vi.fn(async (args: { prompt: string }) => ({
            status: 'needs_user_input',
            requestId: 'elicitation-1',
            prompt: args.prompt,
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
      text: 'What city or neighborhood should I use for this restaurants search?',
      steps: 3,
    });
    expect(result.failed).toBeUndefined();
  });

  it('fulfills restaurant near-me requests by resolving location and searching before answering', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'model should not write the final restaurant answer', steps: 1 });
    const toolCalls: string[] = [];
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
        id: 'webmcp:search_web',
        label: 'Search web',
        description: 'Search the web for external facts and restaurant results.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
      {
        id: 'webmcp:elicit_user_input',
        label: 'Elicit user input',
        description: 'Ask the user for missing data before execution.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'user-context-mcp',
        subGroupLabel: 'User Context',
      },
    ];
    const userContextPlan: ToolPlan = {
      version: 1,
      goal: 'What is the best restaurant near me?',
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
          execute: vi.fn(async () => ({
            status: 'found',
            query: 'location',
            memories: [{
              id: 'location.city',
              label: 'Saved city',
              value: 'Arlington Heights, IL',
              source: 'workspace-memory',
              updatedAt: '2026-04-26T00:00:00.000Z',
            }],
          })),
        },
        'webmcp:read_browser_location': { execute: vi.fn() },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => {
            if (query.includes('Bar Salotto')) {
              return {
                status: 'found',
                query,
                results: [{
                  title: 'Bar Salotto - Official Site',
                  url: 'https://barsalotto.example',
                  snippet: 'Cocktail bar and Italian restaurant in Arlington Heights.',
                }],
              };
            }
            if (query.includes("Francesca's Tavola")) {
              return {
                status: 'found',
                query,
                results: [{
                  title: "Francesca's Tavola - Yelp",
                  url: 'https://example.com/yelp/francescas-tavola',
                  snippet: 'Yelp listing for a long-running Italian restaurant in Arlington Heights.',
                }],
              };
            }
            if (query.includes('Kaido Sushi')) {
              return {
                status: 'found',
                query,
                results: [{
                  title: 'Kaido Sushi',
                  url: 'https://kaidosushi.example',
                  snippet: 'Sushi restaurant in Arlington Heights.',
                }],
              };
            }
            return {
              status: 'found',
              query,
              results: [
                {
                  title: 'THE 10 BEST Restaurants in Arlington Heights - Tripadvisor',
                  url: 'https://example.com/tripadvisor/arlington-heights',
                  snippet: 'Best Dining in Arlington Heights, Illinois: See 6,312 Tripadvisor traveler reviews of 214 Arlington Heights restaurants and search by cuisine, price, location, and more.',
                },
                {
                  title: 'THE BEST 10 RESTAURANTS in ARLINGTON HEIGHTS, IL - Yelp',
                  url: 'https://example.com/yelp/arlington-heights',
                  snippet: "Best Restaurants in Arlington Heights, IL - Last Updated April 2026 - The Prospect, Nostimo, Bar Salotto, Passero, The Foxtail on the Lake, Hey Nonny, TTOWA, Scratchboard Kitchen, Big Ange's Eatery, Parea Greek Kitchen",
                },
                {
                  title: 'THE 30 BEST Restaurants in Arlington Heights - With Menus, Reviews ...',
                  url: 'https://example.com/menus/arlington-heights',
                  snippet: "We've gathered up the best places to eat in Arlington Heights. Our current favorites are: 1: Bar Salotto, 2: Francesca's Tavola, 3: Kaido Sushi, 4: Kahala Koa Tiki Bar, 5: Osteria Trulli Cucina Pugliese",
                },
              ],
            };
          }),
        },
        'webmcp:elicit_user_input': { execute: vi.fn() },
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
      messages: [{ role: 'user' as const, content: 'What is the best restaurant near me?' }],
      runtime,
    }, userContextPlan, userContextDescriptors, runtime.tools, {
      onToolCall: (toolName) => toolCalls.push(toolName),
    }, {
      ...executeContext,
      action: 'Use AgentBus instructions to answer the restaurant recommendation request after resolving location.',
      toolPolicy: {
        allowedToolIds: userContextDescriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: userContextDescriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });

    expect(toolCalls).toEqual([
      'webmcp:recall_user_context',
      'webmcp:search_web',
      'webmcp:search_web',
      'webmcp:search_web',
      'webmcp:search_web',
    ]);
    expect(runtime.tools['webmcp:read_browser_location'].execute).not.toHaveBeenCalled();
    expect(runtime.tools['webmcp:elicit_user_input'].execute).not.toHaveBeenCalled();
    expect(runtime.tools.cli.execute).not.toHaveBeenCalled();
    expect(runToolAgentMock).not.toHaveBeenCalled();
    expect(runtime.tools['webmcp:search_web'].execute).toHaveBeenCalledWith({
      query: 'best restaurants Arlington Heights IL',
      limit: 3,
    });
    expect(runtime.tools['webmcp:search_web'].execute).toHaveBeenNthCalledWith(2, {
      query: '"Bar Salotto" Arlington Heights IL restaurants official reviews',
      limit: 1,
    });
    expect(runtime.tools['webmcp:search_web'].execute).toHaveBeenNthCalledWith(3, {
      query: '"Francesca\'s Tavola" Arlington Heights IL restaurants official reviews',
      limit: 1,
    });
    expect(runtime.tools['webmcp:search_web'].execute).toHaveBeenNthCalledWith(4, {
      query: '"Kaido Sushi" Arlington Heights IL restaurants official reviews',
      limit: 1,
    });
    expect(result.text).toContain('[Bar Salotto](https://barsalotto.example)');
    expect(result.text).toContain("[Francesca's Tavola](https://example.com/yelp/francescas-tavola)");
    expect(result.text).toContain('[Kaido Sushi](https://kaidosushi.example)');
    expect(result.text).toContain('Why:');
    expect(result.text).toContain('Arlington Heights, IL');
    expect(result.text).not.toContain('[THE 10 BEST Restaurants');
    expect(result.text).not.toContain('[THE BEST 10 RESTAURANTS');
    expect(result.text).not.toContain('AgentBus Result Write-back');
    expect(result).toMatchObject({ steps: 5 });
  });

  it('uses the current user request subject instead of stale restaurant context for nearby searches', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'model should not write the final search answer', steps: 1 });
    const toolCalls: string[] = [];
    const searchQueries: string[] = [];
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
        id: 'webmcp:search_web',
        label: 'Search web',
        description: 'Search the web for external facts and local recommendations.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
      {
        id: 'webmcp:elicit_user_input',
        label: 'Elicit user input',
        description: 'Ask the user for missing data before execution.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'user-context-mcp',
        subGroupLabel: 'User Context',
      },
    ];
    const movieTheaterPlan: ToolPlan = {
      version: 1,
      goal: 'What is the best restaurant near me?',
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
          execute: vi.fn(async () => ({
            status: 'found',
            query: 'location',
            memories: [{
              id: 'location.city',
              label: 'Saved city',
              value: 'Arlington Heights, IL',
              source: 'workspace-memory',
              updatedAt: '2026-04-26T00:00:00.000Z',
            }],
          })),
        },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => {
            searchQueries.push(query);
            if (query.includes('AMC Randhurst')) {
              return {
                status: 'found',
                query,
                results: [{
                  title: 'AMC Randhurst 12 - Official Site',
                  url: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12',
                  snippet: 'Official AMC page for a movie theater near Arlington Heights.',
                }],
              };
            }
            if (query.includes('CMX Arlington Heights')) {
              return {
                status: 'found',
                query,
                results: [{
                  title: 'CMX Arlington Heights - Official Site',
                  url: 'https://www.cmxcinemas.com/location/cmx-arlington-heights',
                  snippet: 'Official theater page with showtimes and amenities.',
                }],
              };
            }
            if (query.includes('Classic Cinemas Elk Grove')) {
              return {
                status: 'found',
                query,
                results: [{
                  title: 'Classic Cinemas Elk Grove Theatre',
                  url: 'https://www.classiccinemas.com/elk-grove',
                  snippet: 'Nearby cinema with recliners and current movie showtimes.',
                }],
              };
            }
            return {
              status: 'found',
              query,
              results: [
                {
                  title: 'Best Movie Theaters near Arlington Heights, IL - Yelp',
                  url: 'https://example.com/yelp/movie-theaters-arlington-heights',
                  snippet: 'Best Movie Theaters near Arlington Heights, IL - AMC Randhurst 12, CMX Arlington Heights, Classic Cinemas Elk Grove Theatre, Wayfarer Theaters.',
                },
                {
                  title: 'Movie Theaters around Arlington Heights - Showtimes',
                  url: 'https://example.com/showtimes/arlington-heights',
                  snippet: 'Find movie theaters around Arlington Heights with showtimes, amenities, and ticket links.',
                },
              ],
            };
          }),
        },
        'webmcp:elicit_user_input': { execute: vi.fn() },
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
      messages: [
        { role: 'user' as const, content: 'What is the best restaurant near me?' },
        { role: 'assistant' as const, content: 'Here are restaurant options near Arlington Heights, IL.' },
        { role: 'user' as const, content: "what're the best movie theaters near me?" },
      ],
      runtime,
    }, movieTheaterPlan, userContextDescriptors, runtime.tools, {
      onToolCall: (toolName) => toolCalls.push(toolName),
    }, {
      ...executeContext,
      action: 'Use AgentBus instructions to answer the restaurant recommendation request after resolving location.',
      toolPolicy: {
        allowedToolIds: userContextDescriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: userContextDescriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });

    expect(toolCalls[0]).toBe('webmcp:recall_user_context');
    expect(searchQueries).toEqual([
      'best movie theaters Arlington Heights IL',
      '"AMC Randhurst 12" Arlington Heights IL movie theaters official reviews',
      '"CMX Arlington Heights" Arlington Heights IL movie theaters official reviews',
      '"Classic Cinemas Elk Grove Theatre" Arlington Heights IL movie theaters official reviews',
    ]);
    expect(searchQueries.join('\n')).not.toMatch(/restaurant|Bar Salotto|Francesca|Kaido/i);
    expect(runtime.tools['webmcp:elicit_user_input'].execute).not.toHaveBeenCalled();
    expect(runtime.tools.cli.execute).not.toHaveBeenCalled();
    expect(runToolAgentMock).not.toHaveBeenCalled();
    expect(result.text).toContain('movie theaters near Arlington Heights, IL');
    expect(result.text).toContain('[AMC Randhurst 12]');
    expect(result.text).toContain('[CMX Arlington Heights]');
    expect(result.text).toContain('[Classic Cinemas Elk Grove Theatre]');
    expect(result.text).not.toMatch(/restaurant|Bar Salotto|Francesca|Kaido|AgentBus Result Write-back/i);
  });

  it('extracts nearby search candidates as entity names instead of review fragments', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'model should not write the final search answer', steps: 1 });
    const searchQueries: string[] = [];
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
        id: 'webmcp:search_web',
        label: 'Search web',
        description: 'Search the web for external facts and local recommendations.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
    ];
    const movieTheaterPlan: ToolPlan = {
      version: 1,
      goal: "what're the best movie theaters near me?",
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
          execute: vi.fn(async () => ({
            status: 'found',
            query: 'location',
            memories: [{
              id: 'location.city',
              label: 'Saved city',
              value: 'Arlington Heights, IL',
              source: 'workspace-memory',
              updatedAt: '2026-04-26T00:00:00.000Z',
            }],
          })),
        },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => {
            searchQueries.push(query);
            if (query.includes('AMC Randhurst 12')) {
              return {
                status: 'found',
                query,
                results: [{
                  title: 'AMC Randhurst 12 - Official Site',
                  url: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12',
                  snippet: 'Official AMC page with showtimes, tickets, and amenities.',
                }],
              };
            }
            if (query.includes('CMX Arlington Heights')) {
              return {
                status: 'found',
                query,
                results: [{
                  title: 'CMX Arlington Heights - Official Site',
                  url: 'https://www.cmxcinemas.com/location/cmx-arlington-heights',
                  snippet: 'Official theater page with showtimes and premium seating details.',
                }],
              };
            }
            if (query.includes('Classic Cinemas Elk Grove Theatre')) {
              return {
                status: 'found',
                query,
                results: [{
                  title: 'Classic Cinemas Elk Grove Theatre',
                  url: 'https://www.classiccinemas.com/elk-grove',
                  snippet: 'Nearby cinema with current showtimes and theater details.',
                }],
              };
            }
            return {
              status: 'found',
              query,
              results: [{
                title: 'Best Movie Theaters near Arlington Heights, IL - Local Guide',
                url: 'https://example.com/movie-theaters/arlington-heights',
                snippet: 'Popular choices around Arlington Heights include AMC Randhurst 12, CMX Arlington Heights, Classic Cinemas Elk Grove Theatre. Recent reviews mention comfortable recliners, fresh popcorn, and friendly staff.',
              }],
            };
          }),
        },
      } as unknown as ToolSet,
      descriptors: userContextDescriptors,
    };

    const result = await runConfiguredExecutorAgent({
      ...baseOptions(),
      messages: [{ role: 'user' as const, content: "what're the best movie theaters near me?" }],
      runtime,
    }, movieTheaterPlan, userContextDescriptors, runtime.tools, {}, {
      ...executeContext,
      action: 'Use AgentBus instructions to answer the current nearby search request.',
      toolPolicy: {
        allowedToolIds: userContextDescriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: userContextDescriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });

    expect(searchQueries).toEqual([
      'best movie theaters Arlington Heights IL',
      '"AMC Randhurst 12" Arlington Heights IL movie theaters official reviews',
      '"CMX Arlington Heights" Arlington Heights IL movie theaters official reviews',
      '"Classic Cinemas Elk Grove Theatre" Arlington Heights IL movie theaters official reviews',
    ]);
    expect(result.text).toContain('[AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12)');
    expect(result.text).toContain('[CMX Arlington Heights](https://www.cmxcinemas.com/location/cmx-arlington-heights)');
    expect(result.text).toContain('[Classic Cinemas Elk Grove Theatre](https://www.classiccinemas.com/elk-grove)');
    expect(result.text).not.toContain('Popular choices around Arlington Heights include');
    expect(result.text).not.toMatch(/comfortable recliners|fresh popcorn|friendly staff/i);
  });

  it('reads available search result pages before giving up on results without snippet candidates', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'model should not write the final search answer', steps: 1 });
    const searchQueries: string[] = [];
    const readUrls: string[] = [];
    const descriptors: ToolDescriptor[] = [
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
        id: 'webmcp:search_web',
        label: 'Search web',
        description: 'Search the web.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
      {
        id: 'webmcp:read_web_page',
        label: 'Read web page',
        description: 'Read a web page.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
    ];
    const runtime: ToolAgentRuntime = {
      tools: {
        'webmcp:recall_user_context': {
          execute: vi.fn(async () => ({
            status: 'found',
            query: 'location',
            memories: [{
              id: 'location.city',
              label: 'Saved city',
              value: 'Arlington Heights, IL',
              source: 'workspace-memory',
              updatedAt: '2026-04-26T00:00:00.000Z',
            }],
          })),
        },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => {
            searchQueries.push(query);
            return {
              status: 'found',
              query,
              results: [{
                title: 'Arlington Heights local dining source',
                url: 'https://example.com/local-dining',
                snippet: 'Local source page with neighborhood dining information.',
              }],
            };
          }),
        },
        'webmcp:read_web_page': {
          execute: vi.fn(async ({ url }: { url: string }) => {
            readUrls.push(url);
            return {
              status: 'read',
              url,
              title: 'Restaurants near Arlington Heights, IL',
              text: 'Restaurants near Arlington Heights, IL. Maharaj Indian Grill is a restaurants with source-backed location evidence in Arlington Heights.',
              links: [{
                text: 'Maharaj Indian Grill',
                url: 'https://www.maharajgrill.com/',
              }],
              jsonLd: [],
              observations: [],
              entities: [{
                name: 'Maharaj Indian Grill',
                url: 'https://www.maharajgrill.com/',
                evidence: 'Maharaj Indian Grill is a restaurants with source-backed location evidence in Arlington Heights.',
              }],
            };
          }),
        },
      } as unknown as ToolSet,
      descriptors,
    };
    const searchPlan: ToolPlan = {
      version: 1,
      goal: 'What are the best restaurants near me?',
      selectedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
      steps: [],
      createdToolFiles: [],
      actorToolAssignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
    };

    const result = await runConfiguredExecutorAgent({
      ...baseOptions(),
      messages: [{ role: 'user' as const, content: 'What are the best restaurants near me?' }],
      runtime,
    }, searchPlan, descriptors, runtime.tools, {}, {
      ...executeContext,
      action: 'Use AgentBus instructions to answer the current nearby search request.',
      toolPolicy: {
        allowedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });

    expect(searchQueries[0]).toBe('best restaurants Arlington Heights IL');
    expect(readUrls).toEqual(['https://example.com/local-dining']);
    expect(result.text).toContain('[Maharaj Indian Grill](https://www.maharajgrill.com/)');
    expect(result.failed).not.toBe(true);
  });

  it('analyzes aggregate search results and reads source pages instead of treating review snippets as entity names', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'model should not write the final search answer', steps: 1 });
    const searchQueries: string[] = [];
    const toolCalls: string[] = [];
    const busAppend = vi.fn(async (_payload: Payload) => ({ id: 'entry' }));
    const descriptors: ToolDescriptor[] = [
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
        id: 'webmcp:search_web',
        label: 'Search web',
        description: 'Search the web for external facts and local recommendations.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
      {
        id: 'webmcp:read_web_page',
        label: 'Read web page',
        description: 'Read and extract evidence from a search result page.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
    ];
    const runtime: ToolAgentRuntime = {
      tools: {
        'webmcp:recall_user_context': {
          execute: vi.fn(async () => ({
            status: 'found',
            query: 'location',
            memories: [{
              id: 'location.city',
              label: 'Saved city',
              value: 'Arlington Heights, IL',
              source: 'workspace-memory',
              updatedAt: '2026-04-26T00:00:00.000Z',
            }],
          })),
        },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => {
            searchQueries.push(query);
            return {
              status: 'found',
              query,
              results: [
                {
                  title: 'Movie Showtimes and Theaters near Arlington Heights, IL',
                  url: 'https://www.fandango.com/arlington-heights_il_movietimes',
                  snippet: 'Discover showtimes and movie theaters near you with Fandango! Find showtimes, tickets, and more for your favorite cinema experience in Arlington Heights, IL',
                },
                {
                  title: 'The Best 10 Cinema near Arlington Heights, IL 60004 - Yelp',
                  url: 'https://www.yelp.com/search?cflt=movietheaters&find_loc=Arlington+Heights,+IL+60004',
                  snippet: 'Frequently Asked Questions and Answers What are people saying about cinema near Arlington Heights, IL? This is a review for cinema near Arlington Heights, IL: "This is one of my top 3 movie theaters - period. It&#x27;s a unique theater in that in addition to movies, they have a nice bar, bag toss, pool tables, and a fun ambiance."',
                },
                {
                  title: 'Movie theaters and showtimes near 60004, Arlington Heights, IL',
                  url: 'https://www.showtimes.com/movie-times/60004-arlington-heights-il/',
                  snippet: 'Local Movie Times and Movie Theaters near 60004, Arlington Heights, IL.',
                },
              ],
            };
          }),
        },
        'webmcp:read_web_page': {
          execute: vi.fn(async ({ url }: { url: string }) => {
            if (url.includes('fandango')) {
              return {
                status: 'read',
                url,
                title: 'Movie Theaters near Arlington Heights',
                text: 'Theaters. TV Shows. FanStore. Movies. Supergirl Trailer. Skip to Main Content. AMC Randhurst 12 at 200 Randhurst Village Dr, Mount Prospect near Arlington Heights. CMX Arlington Heights at 53 S Evergreen Ave, Arlington Heights. Classic Cinemas Elk Grove Theatre near Arlington Heights.',
                links: [
                  { text: 'Theaters', url: 'https://www.fandango.com/theaters' },
                  { text: 'TV Shows', url: 'https://www.fandango.com/tv' },
                  { text: 'FanStore', url: 'https://www.fandango.com/fanstore' },
                  { text: 'Movies', url: 'https://www.fandango.com/movies' },
                  { text: "'Supergirl' Trailer", url: 'https://www.fandango.com/movie-news/supergirl-trailer' },
                  { text: 'Skip to Main Content', url: 'https://www.fandango.com/arlington-heights_il_movietimes#main' },
                  { text: 'AMC Randhurst 12', url: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12' },
                  { text: 'CMX Arlington Heights', url: 'https://www.cmxcinemas.com/location/cmx-arlington-heights' },
                ],
                jsonLd: [],
                entities: [
                  { name: 'Theaters', url: 'https://www.fandango.com/theaters', evidence: 'site navigation category' },
                  { name: 'TV Shows', url: 'https://www.fandango.com/tv', evidence: 'site navigation category' },
                  { name: 'FanStore', url: 'https://www.fandango.com/fanstore', evidence: 'site merchandise section' },
                  { name: 'Movies', url: 'https://www.fandango.com/movies', evidence: 'navigation link' },
                  { name: "'Supergirl' Trailer", url: 'https://www.fandango.com/movie-news/supergirl-trailer', evidence: 'article link' },
                  { name: 'Skip to Main Content', url: 'https://www.fandango.com/arlington-heights_il_movietimes#main', evidence: 'skip link' },
                  { name: 'AMC Randhurst 12', url: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12', evidence: 'Fandango theater listing near Arlington Heights at Randhurst Village' },
                  { name: 'CMX Arlington Heights', url: 'https://www.cmxcinemas.com/location/cmx-arlington-heights', evidence: 'Fandango theater listing in Arlington Heights, IL' },
                ],
              };
            }
            return {
              status: 'read',
              url,
              title: 'Cinema near Arlington Heights',
              text: 'Classic Cinemas Elk Grove Theatre is a nearby cinema option.',
              links: [{ text: 'Classic Cinemas Elk Grove Theatre', url: 'https://www.classiccinemas.com/elk-grove' }],
              jsonLd: [],
              entities: [
                { name: 'Classic Cinemas Elk Grove Theatre', url: 'https://www.classiccinemas.com/elk-grove', evidence: 'source page listing' },
              ],
            };
          }),
        },
      } as unknown as ToolSet,
      descriptors,
    };
    const movieTheaterPlan: ToolPlan = {
      version: 1,
      goal: "what're the best movie theaters near me?",
      selectedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
      steps: [],
      createdToolFiles: [],
      actorToolAssignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
    };

    const result = await runConfiguredExecutorAgent({
      ...baseOptions(),
      messages: [{ role: 'user' as const, content: "what're the best movie theaters near me?" }],
      runtime,
    }, movieTheaterPlan, descriptors, runtime.tools, {
      onToolCall: (toolName) => toolCalls.push(toolName),
    }, {
      ...executeContext,
      bus: { append: busAppend } as unknown as LogActActorExecuteContext['bus'],
      action: 'Use AgentBus instructions to answer the current nearby search request.',
      toolPolicy: {
        allowedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });

    expect(searchQueries).toEqual(['best movie theaters Arlington Heights IL']);
    expect(searchQueries.join('\n')).not.toMatch(/period|unique theater|they have a nice bar|local movie times/i);
    expect(toolCalls).toEqual([
      'webmcp:recall_user_context',
      'webmcp:search_web',
      'webmcp:read_web_page',
      'webmcp:read_web_page',
    ]);
    expect(busAppend.mock.calls.some(([payload]) => payload.meta?.actorId === 'search-analyzer')).toBe(true);
    const toolValidationResults = busAppend.mock.calls
      .map(([payload]) => payload)
      .filter((payload): payload is Extract<Payload, { type: PayloadType.Result }> => (
        payload.type === PayloadType.Result
        && payload.meta?.actorId === 'validation-agent'
        && String(payload.intentId).includes('validate-tool-call')
      ));
    expect(toolValidationResults).toHaveLength(toolCalls.length);
    expect(toolValidationResults.map((payload) => payload.output).join('\n')).toContain('recursive-tool-call-validation');
    expect(toolValidationResults.map((payload) => payload.output).join('\n')).toContain('webmcp:search_web');
    expect(result.text).toContain('[AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12)');
    expect(result.text).toMatch(/AMC Randhurst 12[\s\S]*(?:Mount Prospect|Randhurst|Arlington Heights)/);
    expect(result.text).toContain('[CMX Arlington Heights](https://www.cmxcinemas.com/location/cmx-arlington-heights)');
    expect(result.text).toMatch(/CMX Arlington Heights[\s\S]*Arlington Heights/);
    expect(result.text).toContain('[Classic Cinemas Elk Grove Theatre](https://www.classiccinemas.com/elk-grove)');
    expect(result.text).not.toMatch(/period|unique theater|they have a nice bar|Movie Showtimes and Theaters|^\s*\d+\.\s+\[(?:Theaters|TV Shows|FanStore|Movies|'Supergirl' Trailer|Skip to Main Content)\]|AgentBus Result Write-back/im);
  });

  it('renders only structured accepted candidates when source pages mix entities with page chrome', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'model should not write the final search answer', steps: 1 });
    const busAppend = vi.fn(async (_payload: Payload) => ({ id: 'entry' }));
    const descriptors: ToolDescriptor[] = [
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
        id: 'webmcp:search_web',
        label: 'Search web',
        description: 'Search the web for external facts and local recommendations.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
      {
        id: 'webmcp:read_web_page',
        label: 'Read web page',
        description: 'Read and extract evidence from a search result page.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
    ];
    const runtime: ToolAgentRuntime = {
      tools: {
        'webmcp:recall_user_context': {
          execute: vi.fn(async () => ({
            status: 'found',
            query: 'location',
            memories: [{
              id: 'location.city',
              label: 'Saved city',
              value: 'Arlington Heights, IL',
              source: 'workspace-memory',
              updatedAt: '2026-04-26T00:00:00.000Z',
            }],
          })),
        },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => ({
            status: 'found',
            query,
            results: [
              {
                title: 'Movie Showtimes and Theaters near Arlington Heights, IL',
                url: 'https://www.fandango.com/arlington-heights_il_movietimes',
                snippet: 'Discover showtimes and movie theaters near you with Fandango in Arlington Heights, IL.',
              },
              {
                title: 'Movie theaters and showtimes near 60004, Arlington Heights, IL',
                url: 'https://www.moviefone.com/showtimes/theaters/arlington-heights-il/60004/',
                snippet: 'Local Movie Times and Movie Theaters near 60004, Arlington Heights, IL.',
              },
            ],
          })),
        },
        'webmcp:read_web_page': {
          execute: vi.fn(async ({ url }: { url: string }) => {
            if (url.includes('fandango')) {
              return {
                status: 'read',
                url,
                title: 'Movie Theaters near Arlington Heights',
                text: 'At Home. Streaming. Coming Soon. AMC Randhurst 12 movie theater at Randhurst Village in Mount Prospect near Arlington Heights. CMX Arlington Heights movie theater at 53 S Evergreen Ave in Arlington Heights.',
                links: [
                  { text: 'At Home', url: 'https://www.fandango.com/watch-at-home' },
                  { text: 'Streaming', url: 'https://www.fandango.com/streaming' },
                  { text: 'Coming Soon', url: 'https://www.fandango.com/coming-soon' },
                  { text: 'AMC Randhurst 12', url: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12' },
                  { text: 'CMX Arlington Heights', url: 'https://www.cmxcinemas.com/location/cmx-arlington-heights' },
                ],
                jsonLd: [],
                entities: [
                  { name: 'At Home', url: 'https://www.fandango.com/watch-at-home', evidence: 'page link' },
                  { name: 'Streaming', url: 'https://www.fandango.com/streaming', evidence: 'page link' },
                  { name: 'Coming Soon', url: 'https://www.fandango.com/coming-soon', evidence: 'page link' },
                  { name: 'AMC Randhurst 12', url: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12', evidence: 'movie theater listing at Randhurst Village in Mount Prospect near Arlington Heights' },
                  { name: 'CMX Arlington Heights', url: 'https://www.cmxcinemas.com/location/cmx-arlington-heights', evidence: 'movie theater listing at 53 S Evergreen Ave in Arlington Heights, IL' },
                ],
              };
            }
            return {
              status: 'read',
              url,
              title: 'Cinema near Arlington Heights',
              text: 'Classic Cinemas Elk Grove Theatre is a movie theater in Elk Grove Village near Arlington Heights.',
              links: [{ text: 'Classic Cinemas Elk Grove Theatre', url: 'https://www.classiccinemas.com/elk-grove' }],
              jsonLd: [],
              entities: [
                { name: 'Classic Cinemas Elk Grove Theatre', url: 'https://www.classiccinemas.com/elk-grove', evidence: 'movie theater listing in Elk Grove Village near Arlington Heights' },
              ],
            };
          }),
        },
      } as unknown as ToolSet,
      descriptors,
    };
    const movieTheaterPlan: ToolPlan = {
      version: 1,
      goal: "what're the best movie theaters near me?",
      selectedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
      steps: [],
      createdToolFiles: [],
      actorToolAssignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
    };

    const result = await runConfiguredExecutorAgent({
      ...baseOptions(),
      messages: [{ role: 'user' as const, content: "what're the best movie theaters near me?" }],
      runtime,
    }, movieTheaterPlan, descriptors, runtime.tools, {}, {
      ...executeContext,
      bus: { append: busAppend } as unknown as LogActActorExecuteContext['bus'],
      action: 'Use AgentBus instructions to answer the current nearby search request.',
      toolPolicy: {
        allowedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });

    expect(result.text).toContain('[AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12)');
    expect(result.text).toContain('Mount Prospect');
    expect(result.text).toContain('[CMX Arlington Heights](https://www.cmxcinemas.com/location/cmx-arlington-heights)');
    expect(result.text).toContain('Arlington Heights');
    expect(result.text).toContain('[Classic Cinemas Elk Grove Theatre](https://www.classiccinemas.com/elk-grove)');
    expect(result.text).not.toMatch(/^\s*\d+\.\s+\[(?:At Home|Streaming|Coming Soon)\]/im);
    const structuredCandidateResults = busAppend.mock.calls
      .map(([payload]) => payload)
      .filter((payload): payload is Extract<Payload, { type: PayloadType.Result }> => (
        payload.type === PayloadType.Result
        && payload.meta?.actorId === 'search-analyzer'
        && String(payload.intentId).includes('validated-candidates')
      ));
    expect(structuredCandidateResults).toHaveLength(1);
    const candidatePayload = JSON.parse(structuredCandidateResults[0].output) as {
      candidates: Array<{ name: string; validationStatus: string; subjectMatch: boolean; locationEvidence: string[]; entityLink: string; sourceEvidence: string[] }>;
      rejected: Array<{ name: string; validationStatus: string }>;
    };
    expect(candidatePayload.candidates.map((candidate) => candidate.name)).toEqual(expect.arrayContaining([
      'AMC Randhurst 12',
      'CMX Arlington Heights',
      'Classic Cinemas Elk Grove Theatre',
    ]));
    expect(candidatePayload.candidates.every((candidate) => (
      candidate.validationStatus === 'accepted'
      && candidate.subjectMatch
      && candidate.entityLink.startsWith('https://')
      && candidate.locationEvidence.length > 0
      && candidate.sourceEvidence.length > 0
    ))).toBe(true);
    expect(candidatePayload.rejected.map((candidate) => candidate.name)).toEqual(expect.arrayContaining([
      'At Home',
      'Streaming',
      'Coming Soon',
    ]));
  });

  it('extracts real entities from subject-specific nearby page text instead of returning insufficient evidence', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'model should not write the final search answer', steps: 1 });
    const searchQueries: string[] = [];
    const descriptors: ToolDescriptor[] = [
      {
        id: 'webmcp:recall_user_context',
        label: 'Recall user context',
        description: 'Recall app-owned memory.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'user-context-mcp',
        subGroupLabel: 'User Context',
      },
      {
        id: 'webmcp:search_web',
        label: 'Search web',
        description: 'Search the web.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
      {
        id: 'webmcp:read_web_page',
        label: 'Read web page',
        description: 'Read and extract evidence from a search result page.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
    ];
    const runtime: ToolAgentRuntime = {
      tools: {
        'webmcp:recall_user_context': {
          execute: vi.fn(async () => ({
            status: 'found',
            query: 'location',
            memories: [{
              id: 'location.city',
              label: 'Saved city',
              value: 'Arlington Heights, IL',
              source: 'workspace-memory',
              updatedAt: '2026-04-26T00:00:00.000Z',
            }],
          })),
        },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => {
            searchQueries.push(query);
            if (/amc dine-in rosemont 12/i.test(query)) {
              return {
                status: 'found',
                query,
                results: [{
                  title: 'AMC DINE-IN Rosemont 12 - AMC Theatres',
                  url: 'https://www.amctheatres.com/movie-theatres/chicago/amc-dine-in-rosemont-12',
                  snippet: 'Movie theater in Rosemont near Arlington Heights, IL.',
                }],
              };
            }
            if (/amc hawthorn 12/i.test(query)) {
              return {
                status: 'found',
                query,
                results: [{
                  title: 'AMC Hawthorn 12 - AMC Theatres',
                  url: 'https://www.amctheatres.com/movie-theatres/chicago/amc-hawthorn-12',
                  snippet: 'Movie theater in Vernon Hills near Arlington Heights, IL.',
                }],
              };
            }
            if (/amc randhurst 12/i.test(query)) {
              return {
                status: 'found',
                query,
                results: [{
                  title: 'AMC Randhurst 12 - AMC Theatres',
                  url: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12',
                  snippet: 'Movie theater at 200 Randhurst Village Dr, Mount Prospect near Arlington Heights, IL.',
                }],
              };
            }
            return {
              status: 'found',
              query,
              results: [
                {
                  title: 'Movie Showtimes and Theaters near Arlington Heights, IL',
                  url: 'https://www.fandango.com/arlington-heights_il_movietimes',
                  snippet: 'Find movie times and theaters near Arlington Heights, IL.',
                },
                {
                  title: 'Movie Showtimes Near Arlington Heights, IL 60004 | Moviefone',
                  url: 'https://www.moviefone.com/showtimes/theaters/arlington-heights-il/60004/',
                  snippet: 'Find movie showtimes and movie theaters near Arlington Heights, IL.',
                },
              ],
            };
          }),
        },
        'webmcp:read_web_page': {
          execute: vi.fn(async ({ url }: { url: string }) => ({
            status: 'read',
            url,
            title: 'Movie Showtimes and Theaters near Arlington Heights, IL',
            text: [
              'Skip to Main Content Go Movies Theaters FanStore At Home Movie News Sign In/Join FanClub Offers',
              'Movie times + Tickets near Fandango Ticketing Theaters My theaters',
              'Nearby Theaters: Select Theater AMC DINE-IN Rosemont 12 AMC Hawthorn 12 AMC Loews Streets Of Woodfield 20 AMC Niles 12 AMC Randhurst 12 Cinemark Century Deer Park 16 Cinergy Wheeling Classic Cinemas Elk Grove XQ CMX Old Orchard Luxury Landmark At The Glen Pickwick Theatre Theater Chain Movie Times by Cities',
            ].join(' '),
            links: [
              { text: 'Movies', url: 'https://www.fandango.com/movies-in-theaters' },
              { text: 'Theaters', url: 'https://www.fandango.com/movietimes' },
              { text: 'FanStore', url: 'https://store.fandango.com/' },
              { text: 'At Home', url: 'https://athome.fandango.com/' },
              { text: 'Movie News', url: 'https://www.fandango.com/movie-news' },
              { text: 'Sign In/Join', url: 'https://www.fandango.com/accounts/join-now' },
              { text: 'FanClub', url: 'https://www.fandango.com/fanclub/memberships' },
            ],
            jsonLd: [],
            entities: [],
          })),
        },
      } as unknown as ToolSet,
      descriptors,
    };
    const movieTheaterPlan: ToolPlan = {
      version: 1,
      goal: "what're the best movie theaters near me?",
      selectedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
      steps: [],
      createdToolFiles: [],
      actorToolAssignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
    };

    const result = await runConfiguredExecutorAgent({
      ...baseOptions(),
      messages: [{ role: 'user' as const, content: "what're the best movie theaters near me?" }],
      runtime,
    }, movieTheaterPlan, descriptors, runtime.tools, {}, {
      ...executeContext,
      action: 'Use AgentBus instructions to answer the current nearby search request.',
      toolPolicy: {
        allowedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });

    expect(result.failed).not.toBe(true);
    expect(searchQueries).toEqual(expect.arrayContaining([
      '"AMC DINE-IN Rosemont 12" Arlington Heights IL movie theaters official reviews',
      '"AMC Hawthorn 12" Arlington Heights IL movie theaters official reviews',
    ]));
    expect(result.text).toContain('[AMC DINE-IN Rosemont 12](https://www.amctheatres.com/movie-theatres/chicago/amc-dine-in-rosemont-12)');
    expect(result.text).toContain('[AMC Hawthorn 12](https://www.amctheatres.com/movie-theatres/chicago/amc-hawthorn-12)');
    expect(result.text).toContain('AMC Loews Streets Of Woodfield 20');
    expect(result.text).not.toMatch(/^\s*\d+\.\s+\[(?:Movies|Theaters|FanStore|At Home|Movie News|Sign In\/Join|FanClub|Movie Times by Cities)\]/im);
  });

  it('rejects live-style page chrome and address/location labels even when broad page text repeats subject and location words', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'model should not write the final search answer', steps: 1 });
    const searchQueries: string[] = [];
    const busAppend = vi.fn(async (_payload: Payload) => ({ id: 'entry' }));
    const descriptors: ToolDescriptor[] = [
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
        id: 'webmcp:search_web',
        label: 'Search web',
        description: 'Search the web for external facts and local recommendations.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
      {
        id: 'webmcp:read_web_page',
        label: 'Read web page',
        description: 'Read and extract evidence from a search result page.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
    ];
    const runtime: ToolAgentRuntime = {
      tools: {
        'webmcp:recall_user_context': {
          execute: vi.fn(async () => ({
            status: 'found',
            query: 'location',
            memories: [{
              id: 'location.city',
              label: 'Saved city',
              value: 'Arlington Heights, IL',
              source: 'workspace-memory',
              updatedAt: '2026-04-26T00:00:00.000Z',
            }],
          })),
        },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => {
            searchQueries.push(query);
            if (query === 'movie theaters names near Arlington Heights IL') {
              return {
                status: 'found',
                query,
                results: [{
                  title: 'Movie theaters near Arlington Heights, IL - CinemaClock',
                  url: 'https://www.cinemaclock.com/arlington-heights-il/movie-theaters',
                  snippet: 'Find movie theaters near you in the Arlington Heights area with over 100 cinema locations in the region, including Mount Prospect, Wheeling, Schaumburg, Deer Park, Elk Grove Village, and more.',
                }],
              };
            }
            return {
              status: 'found',
              query,
              results: [
                {
                  title: 'Movie Showtimes and Theaters near Arlington Heights, IL',
                  url: 'https://www.fandango.com/arlington-heights_il_movietimes',
                  snippet: 'Discover showtimes and movie theaters near you with Fandango in Arlington Heights, IL.',
                },
                {
                  title: 'Movie theaters and showtimes near 60004, Arlington Heights, IL',
                  url: 'https://www.moviefone.com/showtimes/theaters/arlington-heights-il/60004/',
                  snippet: 'Local Movie Times and Movie Theaters near 60004, Arlington Heights, IL.',
                },
              ],
            };
          }),
        },
        'webmcp:read_web_page': {
          execute: vi.fn(async ({ url }: { url: string }) => ({
            status: 'read',
            url,
            title: url.includes('moviefone')
              ? 'Movie theaters and showtimes near 60004, Arlington Heights, IL'
              : 'Movie Theaters near Arlington Heights',
            text: [
              'Skip to Main Content Go Movies Theaters FanStore At Home Movie News Sign In/Join FanClub.',
              'Moviefone TV is displayed in the global navigation for movie theaters near Arlington Heights, IL.',
              'Sign In/Join appears in the account menu for movie theaters near Arlington Heights, IL.',
              'FanClub appears in the community navigation for movie theaters near Arlington Heights, IL.',
              'Movie Showtimes Near Arlington Heights, IL 60004 | Moviefone.',
              'Movie Showimes is a misspelled showtimes heading on a movie theater listing page near Arlington Heights, IL.',
              'IL 60004 Update Zipcode Monday is a schedule control on the showtimes page.',
              '{"@context":"http://schema.org","@type":"TheaterEvent","location":{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Mt Prospect","addressRegion":"IL","postalCode":"60056","streetAddress":"200 Randhurst Village Dr"},"name":"arlington heights, il"},"name":"arlington heights, il"}',
            ].join(' '),
            links: [
              { text: 'Moviefone TV', url: 'https://www.moviefone.com/tv/' },
              { text: 'Sign In/Join', url: 'https://www.moviefone.com/login/' },
              { text: 'FanClub', url: 'https://www.moviefone.com/fanclub/' },
              { text: 'Movie Showimes', url: 'https://www.moviefone.com/showtimes/theaters/arlington-heights-il/60004/' },
              { text: 'IL 60004 Update Zipcode Monday', url: 'https://www.moviefone.com/showtimes/theaters/arlington-heights-il/60004/' },
              { text: 'Arlington Heights', url: 'https://www.fandango.com/arlington-heights_il_movietimes' },
              { text: 'IL 60004', url: 'https://www.moviefone.com/showtimes/theaters/arlington-heights-il/60004/' },
              { text: 'Mt Prospect', url: 'https://www.fandango.com/arlington-heights_il_movietimes' },
            ],
            jsonLd: [],
            entities: [
              { name: 'Moviefone TV', url: 'https://www.moviefone.com/tv/', evidence: 'page link' },
              { name: 'Sign In/Join', url: 'https://www.moviefone.com/login/', evidence: 'page link' },
              { name: 'FanClub', url: 'https://www.moviefone.com/fanclub/', evidence: 'page link' },
              {
                name: 'Movie Showimes',
                url: 'https://www.moviefone.com/showtimes/theaters/arlington-heights-il/60004/',
                evidence: 'Movie Showimes is a misspelled showtimes heading on a movie theater listing page near Arlington Heights, IL.',
              },
              {
                name: 'IL 60004 Update Zipcode Monday',
                url: 'https://www.moviefone.com/showtimes/theaters/arlington-heights-il/60004/',
                evidence: 'IL 60004 Update Zipcode Monday is a schedule control on the showtimes page.',
              },
              {
                name: 'Arlington Heights',
                url: 'https://www.fandango.com/arlington-heights_il_movietimes',
                evidence: 'Movie Showtimes and Theaters near Arlington Heights, IL | Fandango {"@type":"TheaterEvent","location":{"@type":"Place","name":"arlington heights, il"}}',
              },
              {
                name: 'IL 60004',
                url: 'https://www.moviefone.com/showtimes/theaters/arlington-heights-il/60004/',
                evidence: 'Movie Showtimes Near Arlington Heights, IL 60004 | Moviefone',
              },
              {
                name: 'Mt Prospect',
                url: 'https://www.fandango.com/arlington-heights_il_movietimes',
                evidence: '{"@type":"PostalAddress","addressLocality":"Mt Prospect","addressRegion":"IL","postalCode":"60056","streetAddress":"200 Randhurst Village Dr"}',
              },
            ],
          })),
        },
      } as unknown as ToolSet,
      descriptors,
    };
    const movieTheaterPlan: ToolPlan = {
      version: 1,
      goal: "what're the best movie theaters near me?",
      selectedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
      steps: [],
      createdToolFiles: [],
      actorToolAssignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
    };

    const result = await runConfiguredExecutorAgent({
      ...baseOptions(),
      messages: [{ role: 'user' as const, content: "what're the best movie theaters near me?" }],
      runtime,
    }, movieTheaterPlan, descriptors, runtime.tools, {}, {
      ...executeContext,
      bus: { append: busAppend } as unknown as LogActActorExecuteContext['bus'],
      action: 'Use AgentBus instructions to answer the current nearby search request.',
      toolPolicy: {
        allowedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });

    expect(searchQueries[0]).toBe('best movie theaters Arlington Heights IL');
    expect(result.failed).toBe(true);
    expect(result.text).toContain('I could not find enough validated movie theaters near Arlington Heights, IL');
    expect(result.text).not.toMatch(/^\s*\d+\.\s+\[(?:Moviefone TV|Sign In\/Join|FanClub|Movie Showimes|IL 60004 Update Zipcode Monday|Arlington Heights|IL 60004|Mt Prospect)\]/im);
    const structuredCandidateResults = busAppend.mock.calls
      .map(([payload]) => payload)
      .filter((payload): payload is Extract<Payload, { type: PayloadType.Result }> => (
        payload.type === PayloadType.Result
        && payload.meta?.actorId === 'search-analyzer'
        && String(payload.intentId).includes('validated-candidates')
      ));
    const candidatePayload = JSON.parse(structuredCandidateResults.at(-1)?.output ?? '{}') as {
      candidates?: Array<{ name: string }>;
      rejected?: Array<{ name: string; validationFailures: string[] }>;
    };
    expect(candidatePayload.candidates ?? []).toHaveLength(0);
    expect(candidatePayload.rejected?.map((candidate) => candidate.name)).toEqual(expect.arrayContaining([
      'Moviefone TV',
      'Sign In/Join',
      'FanClub',
      'Movie Showimes',
      'IL 60004 Update Zipcode Monday',
      'Arlington Heights',
      'IL 60004',
      'Mt Prospect',
      'Mount Prospect',
      'Wheeling',
      'Schaumburg',
    ]));
    expect(candidatePayload.rejected?.flatMap((candidate) => candidate.validationFailures).join('\n')).toContain('source-backed entity-instance evidence');
  });

  it('rejects script, CSS, and ad artifacts even when they appear on relevant nearby listing pages', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'model should not write the final search answer', steps: 1 });
    const busAppend = vi.fn(async (_payload: Payload) => ({ id: 'entry' }));
    const searchQueries: string[] = [];
    const descriptors: ToolDescriptor[] = [
      {
        id: 'webmcp:recall_user_context',
        label: 'Recall user context',
        description: 'Search app memory for saved user facts.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'user-context-mcp',
        subGroupLabel: 'User Context',
      },
      {
        id: 'webmcp:search_web',
        label: 'Search web',
        description: 'Search the web.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
      {
        id: 'webmcp:read_web_page',
        label: 'Read web page',
        description: 'Read a web page.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
    ];
    const runtime: ToolAgentRuntime = {
      tools: {
        'webmcp:recall_user_context': {
          execute: vi.fn(async () => ({
            status: 'found',
            query: 'location',
            memories: [{
              id: 'location.city',
              label: 'Saved city',
              value: 'Arlington Heights, IL',
              source: 'workspace-memory',
              updatedAt: '2026-04-26T00:00:00.000Z',
            }],
          })),
        },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => {
            searchQueries.push(query);
            return {
              status: query === 'movie theaters names near Arlington Heights IL' ? 'empty' : 'found',
              query,
              results: query === 'movie theaters names near Arlington Heights IL'
                ? []
                : [{
                  title: 'Movie Showtimes and Theaters near Arlington Heights, IL',
                  url: 'https://www.fandango.com/arlington-heights_il_movietimes',
                  snippet: 'Discover showtimes and movie theaters near you with Fandango in Arlington Heights, IL.',
                }, {
                  title: 'Movie theaters and showtimes near 60004, Arlington Heights, IL',
                  url: 'https://www.moviefone.com/showtimes/theaters/arlington-heights-il/60004/',
                  snippet: 'Local Movie Times and Movie Theaters near 60004, Arlington Heights, IL.',
                }],
            };
          }),
        },
        'webmcp:read_web_page': {
          execute: vi.fn(async ({ url }: { url: string }) => ({
            status: 'read',
            url,
            title: url.includes('moviefone')
              ? 'Movie theaters and showtimes near 60004, Arlington Heights, IL'
              : 'Movie Theaters near Arlington Heights',
            text: [
              'Movie theaters near Arlington Heights, IL.',
              'Screen Reader Users: To optimize your experience with your screen reading software, please use our Flixster.com website.',
              'Trending Supergirl Trailer Masters of the Universe Trailer Movies TV Shows Streaming In Theaters Coming Soon Movie Charts Showtimes Highlights News.',
              'Movie Showtimes Near Arlington Heights, IL | Fandango Ticketing Theaters My.',
              'Featured Movie Animal Farm appears in the Fandango movies content area for Arlington Heights showtimes.',
              'Buy a Dolby Ticket to The Devil Wears Prada 2. SCREENX Offer. Use code RUNWAYREADY to redeem the special offer.',
              'Tuscany (2026) Lee Cronin.',
              'Watch New Trailers Movie Theaters Movie.',
              'Made In Hollywood Apex Marty Supreme The Devil Wears Prada.',
              'window.Fandango = { adConfig: { adUnits: ["Multi Logo", "Box Ad"] }, pageType: "theaterselectionpage" };',
              'body { font-family: "Palatino Linotype", Palatino, Georgia, serif; }',
            ].join(' '),
            links: [],
            jsonLd: [],
            observations: [
              {
                kind: 'text-span',
                label: 'Multi Logo',
                evidence: 'page text',
                localContext: 'window.Fandango = { adConfig: { adUnits: ["Multi Logo", "Box Ad"] }, pageType: "theaterselectionpage" };',
                sourceUrl: url,
              },
              {
                kind: 'text-span',
                label: 'Box Ad',
                evidence: 'page text',
                localContext: 'window.Fandango = { adConfig: { adUnits: ["Multi Logo", "Box Ad"] }, pageType: "theaterselectionpage" };',
                sourceUrl: url,
              },
              {
                kind: 'text-span',
                label: 'Palatino Linotype',
                evidence: 'page text',
                localContext: 'body { font-family: "Palatino Linotype", Palatino, Georgia, serif; }',
                sourceUrl: url,
              },
              {
                kind: 'text-span',
                label: 'Screen Reader Users',
                evidence: 'page text',
                localContext: 'Screen Reader Users: To optimize your experience with your screen reading software, please use our Flixster.com website.',
                sourceUrl: url,
              },
              {
                kind: 'text-span',
                label: 'Streaming In Theaters Coming Soon Movie',
                evidence: 'page text',
                localContext: 'Trending Supergirl Trailer Masters of the Universe Trailer Movies TV Shows Streaming In Theaters Coming Soon Movie Charts Showtimes Highlights News.',
                sourceUrl: url,
              },
              {
                kind: 'text-span',
                label: 'Fandango Ticketing Theaters My',
                evidence: 'page text',
                localContext: 'Movie Showtimes Near Arlington Heights, IL | Fandango Ticketing Theaters My.',
                sourceUrl: url,
              },
              {
                kind: 'text-span',
                label: 'Featured Movie Animal Farm',
                evidence: 'page text',
                localContext: 'Featured Movie Animal Farm appears in the Fandango movies content area for Arlington Heights showtimes.',
                sourceUrl: url,
              },
              {
                kind: 'text-span',
                label: 'SCREENX Offer',
                evidence: 'page text',
                localContext: 'Buy a Dolby Ticket to The Devil Wears Prada 2. SCREENX Offer. Use code RUNWAYREADY to redeem the special offer.',
                sourceUrl: url,
              },
              {
                kind: 'text-span',
                label: 'Lee Cronin',
                evidence: 'page text',
                localContext: 'Tuscany (2026) Lee Cronin.',
                sourceUrl: url,
              },
              {
                kind: 'text-span',
                label: 'Watch New Trailers Movie Theaters Movie',
                evidence: 'page text',
                localContext: 'Watch New Trailers Movie Theaters Movie.',
                sourceUrl: url,
              },
              {
                kind: 'text-span',
                label: 'Hollywood Apex Marty Supreme The Devil',
                evidence: 'page text',
                localContext: 'Made In Hollywood Apex Marty Supreme The Devil Wears Prada.',
                sourceUrl: url,
              },
            ],
            entities: [
              {
                name: 'Multi Logo',
                url,
                evidence: 'window.Fandango = { adConfig: { adUnits: ["Multi Logo", "Box Ad"] }, pageType: "theaterselectionpage" };',
              },
              {
                name: 'Box Ad',
                url,
                evidence: 'window.Fandango = { adConfig: { adUnits: ["Multi Logo", "Box Ad"] }, pageType: "theaterselectionpage" };',
              },
              {
                name: 'Palatino Linotype',
                url,
                evidence: 'body { font-family: "Palatino Linotype", Palatino, Georgia, serif; }',
              },
              {
                name: 'Screen Reader Users',
                url,
                evidence: 'Screen Reader Users: To optimize your experience with your screen reading software, please use our Flixster.com website.',
              },
              {
                name: 'Streaming In Theaters Coming Soon Movie',
                url,
                evidence: 'Trending Supergirl Trailer Masters of the Universe Trailer Movies TV Shows Streaming In Theaters Coming Soon Movie Charts Showtimes Highlights News.',
              },
              {
                name: 'Fandango Ticketing Theaters My',
                url,
                evidence: 'Movie Showtimes Near Arlington Heights, IL | Fandango Ticketing Theaters My.',
              },
              {
                name: 'Featured Movie Animal Farm',
                url,
                evidence: 'Featured Movie Animal Farm appears in the Fandango movies content area for Arlington Heights showtimes.',
              },
              {
                name: 'SCREENX Offer',
                url,
                evidence: 'Buy a Dolby Ticket to The Devil Wears Prada 2. SCREENX Offer. Use code RUNWAYREADY to redeem the special offer.',
              },
              {
                name: 'Lee Cronin',
                url,
                evidence: 'Tuscany (2026) Lee Cronin.',
              },
              {
                name: 'Watch New Trailers Movie Theaters Movie',
                url,
                evidence: 'Watch New Trailers Movie Theaters Movie.',
              },
              {
                name: 'Hollywood Apex Marty Supreme The Devil',
                url,
                evidence: 'Made In Hollywood Apex Marty Supreme The Devil Wears Prada.',
              },
            ],
          })),
        },
      } as unknown as ToolSet,
      descriptors,
    };
    const movieTheaterPlan: ToolPlan = {
      version: 1,
      goal: "what're the best movie theaters near me?",
      selectedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
      steps: [],
      createdToolFiles: [],
      actorToolAssignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
    };

    const result = await runConfiguredExecutorAgent({
      ...baseOptions(),
      messages: [{ role: 'user' as const, content: "what're the best movie theaters near me?" }],
      runtime,
    }, movieTheaterPlan, descriptors, runtime.tools, {}, {
      ...executeContext,
      bus: { append: busAppend } as unknown as LogActActorExecuteContext['bus'],
      action: 'Use AgentBus instructions to answer the current nearby search request.',
      toolPolicy: {
        allowedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });

    expect(searchQueries[0]).toBe('best movie theaters Arlington Heights IL');
    expect(result.failed).toBe(true);
    expect(result.text).toContain('I could not find enough validated movie theaters near Arlington Heights, IL');
    expect(result.text).not.toMatch(/^\s*\d+\.\s+\[(?:Multi Logo|Box Ad|Palatino Linotype|Screen Reader Users|Streaming In Theaters Coming Soon Movie|Fandango Ticketing Theaters My|Featured Movie Animal Farm|SCREENX Offer|Lee Cronin|Watch New Trailers Movie Theaters Movie|Hollywood Apex Marty Supreme The Devil)\]/im);
    const structuredCandidateResults = busAppend.mock.calls
      .map(([payload]) => payload)
      .filter((payload): payload is Extract<Payload, { type: PayloadType.Result }> => (
        payload.type === PayloadType.Result
        && payload.meta?.actorId === 'search-analyzer'
        && String(payload.intentId).includes('validated-candidates')
      ));
    const candidatePayload = JSON.parse(structuredCandidateResults.at(-1)?.output ?? '{}') as {
      candidates?: Array<{ name: string }>;
      rejected?: Array<{ name: string; validationFailures: string[] }>;
    };
    expect(candidatePayload.candidates ?? []).toHaveLength(0);
    expect(candidatePayload.rejected?.map((candidate) => candidate.name)).toEqual(expect.arrayContaining([
      'Multi Logo',
      'Box Ad',
      'Palatino Linotype',
      'Screen Reader Users',
      'Streaming In Theaters Coming Soon Movie',
      'Fandango Ticketing Theaters My',
      'Featured Movie Animal Farm',
      'SCREENX Offer',
      'Lee Cronin',
      'Watch New Trailers Movie Theaters Movie',
      'Hollywood Apex Marty Supreme The Devil',
    ]));
    expect(candidatePayload.rejected?.flatMap((candidate) => candidate.validationFailures).join('\n')).toContain('candidate label is a generic page, navigation, category, or content label');
  });

  it('fulfills generic external searches without adding location or vertical-specific terms', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'model should not write the final search answer', steps: 1 });
    const searchQueries: string[] = [];
    const descriptors: ToolDescriptor[] = [{
      id: 'webmcp:search_web',
      label: 'Search web',
      description: 'Search the web for external facts and recommendations.',
      group: 'built-in',
      groupLabel: 'Built-In',
      subGroup: 'web-search-mcp',
      subGroupLabel: 'Search',
    }];
    const genericPlan: ToolPlan = {
      version: 1,
      goal: 'What are the best laptops for students?',
      selectedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
      steps: [],
      createdToolFiles: [],
      actorToolAssignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
    };
    const runtime: ToolAgentRuntime = {
      tools: {
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => {
            searchQueries.push(query);
            return {
              status: 'found',
              query,
              results: [
                {
                  title: 'Best laptops for students in 2026 - Review Guide',
                  url: 'https://example.com/student-laptops',
                  snippet: 'Top student laptop picks include Lenovo IdeaPad Slim 5, MacBook Air, and Acer Aspire Go.',
                },
              ],
            };
          }),
        },
        'webmcp:recall_user_context': { execute: vi.fn() },
        'webmcp:elicit_user_input': { execute: vi.fn() },
      } as unknown as ToolSet,
      descriptors,
    };

    const result = await runConfiguredExecutorAgent({
      ...baseOptions(),
      messages: [{ role: 'user' as const, content: 'What are the best laptops for students?' }],
      runtime,
    }, genericPlan, descriptors, runtime.tools, {}, {
      ...executeContext,
      action: 'Use AgentBus instructions to answer the current product recommendation request.',
      toolPolicy: {
        allowedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });

    expect(searchQueries[0]).toBe('best laptops for students');
    expect(searchQueries.join('\n')).not.toMatch(/restaurant|movie theater|near Arlington Heights/i);
    expect(runtime.tools['webmcp:recall_user_context'].execute).not.toHaveBeenCalled();
    expect(runtime.tools['webmcp:elicit_user_input'].execute).not.toHaveBeenCalled();
    expect(runToolAgentMock).not.toHaveBeenCalled();
    expect(result.text).toContain('laptops for students');
    expect(result.text).not.toMatch(/restaurant|movie theater|near Arlington Heights/i);
  });

  it.each([
    ['What are the worst bars near me?', 'worst bars Arlington Heights IL', 'bars', 'Beacon Tap'],
    ['What are the closest parks near me?', 'closest parks Arlington Heights IL', 'parks', 'North School Park'],
    ['What are the most popular coffee shops near me?', 'most popular coffee shops Arlington Heights IL', 'coffee shops', 'CoCo & Blu'],
    ['What are the best restaurants near me?', 'best restaurants Arlington Heights IL', 'restaurants', 'Mitsuwa Marketplace'],
  ])('builds generic ranking searches for %s', async (prompt, expectedQuery, answerSubject, candidateName) => {
    runToolAgentMock.mockResolvedValue({ text: 'model should not write the final search answer', steps: 1 });
    const searchQueries: string[] = [];
    const descriptors: ToolDescriptor[] = [
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
        id: 'webmcp:search_web',
        label: 'Search web',
        description: 'Search the web for external facts and local recommendations.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
    ];
    const runtime: ToolAgentRuntime = {
      tools: {
        'webmcp:recall_user_context': {
          execute: vi.fn(async () => ({
            status: 'found',
            memories: [{
              id: 'location.city',
              label: 'Saved city',
              value: 'Arlington Heights, IL',
              source: 'workspace-memory',
              updatedAt: '2026-04-26T00:00:00.000Z',
            }],
          })),
        },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => {
            searchQueries.push(query);
            return {
              status: 'found',
              query,
              results: [{
                title: `${candidateName} - Reviews and details`,
                url: `https://example.com/${candidateName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
                snippet: `${candidateName} is a sourced result for ${answerSubject} near Arlington Heights, IL.`,
              }],
            };
          }),
        },
      } as unknown as ToolSet,
      descriptors,
    };
    const genericPlan: ToolPlan = {
      version: 1,
      goal: prompt,
      selectedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
      steps: [],
      createdToolFiles: [],
      actorToolAssignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
    };

    const result = await runConfiguredExecutorAgent({
      ...baseOptions(),
      messages: [{ role: 'user' as const, content: prompt }],
      runtime,
    }, genericPlan, descriptors, runtime.tools, {}, {
      ...executeContext,
      action: 'Use AgentBus instructions to answer the current nearby search request.',
      toolPolicy: {
        allowedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });

    expect(searchQueries[0]).toBe(expectedQuery);
    expect(result.text).toContain(candidateName);
    expect(result.text).toContain(answerSubject);
  });

  it('uses compatible user memory preferences for the current subject without leaking them to unrelated searches', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'model should not write the final search answer', steps: 1 });
    const searchQueries: string[] = [];
    const descriptors: ToolDescriptor[] = [
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
        id: 'webmcp:search_web',
        label: 'Search web',
        description: 'Search the web for external facts and local recommendations.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
    ];
    const runtime: ToolAgentRuntime = {
      tools: {
        'webmcp:recall_user_context': {
          execute: vi.fn(async () => ({
            status: 'found',
            memories: [
              {
                id: 'location.city',
                label: 'Saved city',
                value: 'Arlington Heights, IL',
                source: 'workspace-memory',
                updatedAt: '2026-04-26T00:00:00.000Z',
              },
              {
                id: 'preference.cuisine',
                label: 'Food preference',
                value: 'Indian food',
                source: 'workspace-memory',
                updatedAt: '2026-04-26T00:00:00.000Z',
              },
              {
                id: 'preference.response.citations',
                label: 'Response preference',
                value: 'Prefers citations',
                source: 'workspace-memory',
                updatedAt: '2026-04-26T00:00:00.000Z',
              },
            ],
          })),
        },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => {
            searchQueries.push(query);
            const isRestaurant = query.includes('restaurants');
            const name = isRestaurant ? 'Maharaj Indian Grill' : 'AMC Randhurst 12';
            const subject = isRestaurant ? 'restaurants' : 'movie theaters';
            return {
              status: 'found',
              query,
              results: [{
                title: `${name} - Official source`,
                url: `https://example.com/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
                snippet: `${name} is a sourced result for ${subject} near Arlington Heights, IL.`,
              }],
            };
          }),
        },
      } as unknown as ToolSet,
      descriptors,
    };
    const genericPlan: ToolPlan = {
      version: 1,
      goal: 'nearby search',
      selectedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
      steps: [],
      createdToolFiles: [],
      actorToolAssignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
    };

    const restaurantResult = await runConfiguredExecutorAgent({
      ...baseOptions(),
      messages: [{ role: 'user' as const, content: 'What are the best restaurants near me?' }],
      runtime,
    }, genericPlan, descriptors, runtime.tools, {}, {
      ...executeContext,
      action: 'Use AgentBus instructions to answer the current nearby search request.',
      toolPolicy: {
        allowedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });
    const theaterResult = await runConfiguredExecutorAgent({
      ...baseOptions(),
      messages: [{ role: 'user' as const, content: "what're the best movie theaters near me?" }],
      runtime,
    }, genericPlan, descriptors, runtime.tools, {}, {
      ...executeContext,
      action: 'Use AgentBus instructions to answer the current nearby search request.',
      toolPolicy: {
        allowedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });

    expect(searchQueries[0]).toBe('best indian restaurants Arlington Heights IL');
    expect(searchQueries[1]).toBe('best movie theaters Arlington Heights IL');
    expect(restaurantResult.text).toContain('Maharaj Indian Grill');
    expect(theaterResult.text).toContain('AMC Randhurst 12');
    expect(theaterResult.text).not.toMatch(/indian|restaurant/i);
  });

  it('pauses for user input when location is known but web search is unavailable', async () => {
    const toolCalls: string[] = [];
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
        id: 'webmcp:search_web',
        label: 'Search web',
        description: 'Search the web for external facts and restaurant results.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
      {
        id: 'webmcp:elicit_user_input',
        label: 'Elicit user input',
        description: 'Ask the user for missing data before execution.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'user-context-mcp',
        subGroupLabel: 'User Context',
      },
    ];
    const userContextPlan: ToolPlan = {
      version: 1,
      goal: 'What is the best restaurant near me?',
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
          execute: vi.fn(async () => ({
            status: 'found',
            query: 'location',
            memories: [{
              id: 'location.city',
              label: 'Saved city',
              value: 'Arlington Heights, IL',
              source: 'workspace-memory',
              updatedAt: '2026-04-26T00:00:00.000Z',
            }],
          })),
        },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => ({
            status: 'unavailable',
            query,
            reason: 'Search provider unavailable.',
            results: [],
          })),
        },
        'webmcp:elicit_user_input': {
          execute: vi.fn(async (args: { prompt: string }) => ({
            status: 'needs_user_input',
            requestId: 'elicitation-search-source',
            prompt: args.prompt,
            fields: [{ id: 'search-source', label: 'Search source or candidates', required: true }],
          })),
        },
      } as unknown as ToolSet,
      descriptors: userContextDescriptors,
    };

    const result = await runConfiguredExecutorAgent({
      ...baseOptions(),
      messages: [{ role: 'user' as const, content: 'What is the best restaurant near me?' }],
      runtime,
    }, userContextPlan, userContextDescriptors, runtime.tools, {
      onToolCall: (toolName) => toolCalls.push(toolName),
    }, {
      ...executeContext,
      action: 'Use AgentBus instructions to answer the restaurant recommendation request after resolving location.',
      toolPolicy: {
        allowedToolIds: userContextDescriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: userContextDescriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });

    expect(toolCalls).toEqual([
      'webmcp:recall_user_context',
      'webmcp:search_web',
      'webmcp:elicit_user_input',
    ]);
    expect(runToolAgentMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      blocked: true,
      needsUserInput: true,
      text: 'I found your location, but web search is unavailable. Please provide a search source or candidate results for restaurants.\nSearch issue: Search provider unavailable.',
      steps: 3,
    });
    expect(result.failed).toBeUndefined();
  });

  it('reuses an explicit prior chat location for a closest-bars follow-up instead of eliciting again', async () => {
    const toolCalls: string[] = [];
    const searchQueries: string[] = [];
    const descriptors: ToolDescriptor[] = [
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
        id: 'webmcp:search_web',
        label: 'Search web',
        description: 'Search the web for external facts and local recommendations.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
      {
        id: 'webmcp:elicit_user_input',
        label: 'Elicit user input',
        description: 'Ask the user for missing data before execution.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'user-context-mcp',
        subGroupLabel: 'User Context',
      },
    ];
    const barPlan: ToolPlan = {
      version: 1,
      goal: 'closest bars follow-up',
      selectedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
      steps: [],
      createdToolFiles: [],
      actorToolAssignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
    };
    const runtime: ToolAgentRuntime = {
      tools: {
        'webmcp:recall_user_context': {
          execute: vi.fn(async () => ({ status: 'empty', query: 'location', memories: [] })),
        },
        'webmcp:read_browser_location': {
          execute: vi.fn(async () => ({ status: 'denied', reason: 'Browser location denied.' })),
        },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => {
            searchQueries.push(query);
            return {
              status: 'found',
              query,
              results: [{
                title: "Peggy Kinnane's Irish Restaurant & Pub - Official Site",
                url: 'https://www.peggykinnanes.com/',
                snippet: "Peggy Kinnane's Irish Restaurant & Pub is a bar in Arlington Heights, IL.",
              }],
            };
          }),
        },
        'webmcp:elicit_user_input': { execute: vi.fn() },
      } as unknown as ToolSet,
      descriptors,
    };

    const result = await runConfiguredExecutorAgent({
      ...baseOptions(),
      messages: [
        { role: 'user' as const, content: "what're the best movie theaters near me?" },
        { role: 'assistant' as const, content: 'Location: Arlington Heights IL. Here are verified movie theaters nearby.' },
        { role: 'user' as const, content: 'what about closest bars?' },
      ],
      runtime,
    }, barPlan, descriptors, runtime.tools, {
      onToolCall: (toolName) => toolCalls.push(toolName),
    }, {
      ...executeContext,
      action: 'Use AgentBus instructions to answer the current nearby search request.',
      toolPolicy: {
        allowedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });

    expect(searchQueries[0]).toBe('closest bars Arlington Heights IL');
    expect(toolCalls).not.toContain('webmcp:elicit_user_input');
    expect(runtime.tools['webmcp:elicit_user_input'].execute).not.toHaveBeenCalled();
    expect(result.text).toContain("[Peggy Kinnane's Irish Restaurant & Pub](https://www.peggykinnanes.com/)");
  });

  it('recovers closest-bars searches from aggregate directory results before composing the answer', async () => {
    const searchQueries: string[] = [];
    const descriptors: ToolDescriptor[] = [
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
        id: 'webmcp:search_web',
        label: 'Search web',
        description: 'Search the web for external facts and local recommendations.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
      {
        id: 'webmcp:read_web_page',
        label: 'Read web page',
        description: 'Read and extract evidence from a search result page.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
    ];
    const barPlan: ToolPlan = {
      version: 1,
      goal: 'closest bars near me',
      selectedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
      steps: [],
      createdToolFiles: [],
      actorToolAssignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
    };
    const runtime: ToolAgentRuntime = {
      tools: {
        'webmcp:recall_user_context': {
          execute: vi.fn(async () => ({
            status: 'found',
            query: 'location',
            memories: [{
              id: 'location.city',
              label: 'Saved city',
              value: 'Arlington Heights, IL',
              source: 'workspace-memory',
              updatedAt: '2026-04-26T00:00:00.000Z',
            }],
          })),
        },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => {
            searchQueries.push(query);
            if (query === 'bars names near Arlington Heights IL') {
              return {
                status: 'found',
                query,
                results: [
                  {
                    title: "Peggy Kinnane's Irish Restaurant & Pub - Official Site",
                    url: 'https://www.peggykinnanes.com/',
                    snippet: "Peggy Kinnane's Irish Restaurant & Pub is a bar in downtown Arlington Heights, IL.",
                  },
                  {
                    title: 'Hey Nonny - Official Site',
                    url: 'https://www.heynonny.com/',
                    snippet: 'Hey Nonny is a bar and music venue in Arlington Heights, IL.',
                  },
                  {
                    title: "Cortland's Garage Arlington Heights",
                    url: 'https://www.cortlandsgarage.com/',
                    snippet: "Cortland's Garage is a bar and grill in Arlington Heights, IL.",
                  },
                ],
              };
            }
            return {
              status: 'found',
              query,
              results: [
                {
                  title: 'Yelp: Best Bars in Arlington Heights, IL',
                  url: 'https://example.com/yelp-bars',
                  snippet: 'Best bars in Arlington Heights, IL. Browse reviews, directions, menus, and ratings.',
                },
                {
                  title: "Chicago Bound: Arlington Heights' Best Bars",
                  url: 'https://example.com/chicago-bound-bars',
                  snippet: 'A guide to bars around Arlington Heights with neighborhood nightlife picks.',
                },
                {
                  title: 'Yellow Pages: Bars in Arlington Heights',
                  url: 'https://example.com/yellow-pages-bars',
                  snippet: 'Find bars in Arlington Heights, IL with addresses and phone numbers.',
                },
                {
                  title: 'Restaurantji: Best Bars near Arlington Heights',
                  url: 'https://example.com/restaurantji-bars',
                  snippet: 'Best bars near Arlington Heights with ratings and reviews.',
                },
                {
                  title: 'Restaurant Guru: Top 7 pubs & bars',
                  url: 'https://example.com/restaurant-guru-bars',
                  snippet: 'Top pubs and bars in the Arlington Heights area.',
                },
              ],
            };
          }),
        },
        'webmcp:read_web_page': {
          execute: vi.fn(async ({ url }: { url: string }) => ({
            status: 'read',
            url,
            title: 'Directory page',
            text: 'Yelp: Best Bars in Arlington Heights, IL. Chicago Bound: Arlington Heights Best Bars. Yellow Pages: Bars in Arlington Heights. Restaurantji: Best Bars near Arlington Heights. Restaurant Guru: Top 7 pubs & bars.',
            links: [
              { text: 'Yelp: Best Bars in Arlington Heights, IL', url: 'https://example.com/yelp-bars' },
              { text: "Chicago Bound: Arlington Heights' Best Bars", url: 'https://example.com/chicago-bound-bars' },
              { text: 'Yellow Pages: Bars in Arlington Heights', url: 'https://example.com/yellow-pages-bars' },
            ],
            jsonLd: [],
            entities: [],
          })),
        },
      } as unknown as ToolSet,
      descriptors,
    };

    const result = await runConfiguredExecutorAgent({
      ...baseOptions(),
      messages: [{ role: 'user' as const, content: 'what about closest bars near me?' }],
      runtime,
    }, barPlan, descriptors, runtime.tools, {}, {
      ...executeContext,
      action: 'Use AgentBus instructions to answer the current nearby search request.',
      toolPolicy: {
        allowedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });

    expect(searchQueries).toEqual([
      'closest bars Arlington Heights IL',
      'bars names near Arlington Heights IL',
    ]);
    expect(result.text).toContain("[Peggy Kinnane's Irish Restaurant & Pub](https://www.peggykinnanes.com/)");
    expect(result.text).toContain('[Hey Nonny](https://www.heynonny.com/)');
    expect(result.text).toContain("[Cortland's Garage Arlington Heights](https://www.cortlandsgarage.com/)");
    expect(result.text).not.toMatch(/^\s*[-*]?\s*\[?(?:Yelp: Best Bars|Chicago Bound: Arlington Heights' Best Bars|Yellow Pages: Bars in Arlington Heights|Restaurantji: Best Bars near Arlington Heights|Restaurant Guru: Top 7 pubs & bars)/im);
  });

  it('uses prior search context for show-me-more follow-ups instead of searching the literal phrase', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'model should not write the final search answer', steps: 1 });
    const searchQueries: string[] = [];
    const descriptors: ToolDescriptor[] = [
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
        id: 'webmcp:search_web',
        label: 'Search web',
        description: 'Search the web.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
      {
        id: 'webmcp:elicit_user_input',
        label: 'Request user input',
        description: 'Ask the user for missing information.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'user-context-mcp',
        subGroupLabel: 'User Context',
      },
    ];
    const runtime: ToolAgentRuntime = {
      tools: {
        'webmcp:recall_user_context': {
          execute: vi.fn(async () => ({ status: 'empty', memories: [] })),
        },
        'webmcp:elicit_user_input': {
          execute: vi.fn(async () => ({ status: 'needs_user_input', prompt: 'missing context' })),
        },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => {
            searchQueries.push(query);
            if (query.includes("Peggy Kinnane's")) {
              return {
                status: 'found',
                query,
                results: [{
                  title: "Peggy Kinnane's Irish Restaurant & Pub",
                  url: 'https://www.peggykinnanes.com/',
                  snippet: "Official page for Peggy Kinnane's Irish Restaurant & Pub, a bar in Arlington Heights.",
                }],
              };
            }
            if (query.includes('Hey Nonny')) {
              return {
                status: 'found',
                query,
                results: [{
                  title: 'Hey Nonny',
                  url: 'https://www.heynonny.com/',
                  snippet: 'Official page for Hey Nonny, a bar and music venue in Arlington Heights.',
                }],
              };
            }
            if (query.includes("Cortland's Garage")) {
              return {
                status: 'found',
                query,
                results: [{
                  title: "Cortland's Garage",
                  url: 'https://www.cortlandsgarage.com/',
                  snippet: "Official page for Cortland's Garage, a bar in Arlington Heights.",
                }],
              };
            }
            return {
              status: 'found',
              query,
              results: [{
                title: 'Bars near Arlington Heights - Source Listing',
                url: 'https://example.com/bars',
                snippet: "Local bars near Arlington Heights include Sports Page Bar & Grill Arlington Heights, Peggy Kinnane's Irish Restaurant & Pub, Hey Nonny, Cortland's Garage.",
              }],
            };
          }),
        },
      } as unknown as ToolSet,
      descriptors,
    };
    const searchPlan: ToolPlan = {
      version: 1,
      goal: 'show me 3 more',
      selectedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
      steps: [],
      createdToolFiles: [],
      actorToolAssignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
    };

    const result = await runConfiguredExecutorAgent({
      ...baseOptions(),
      messages: [
        { role: 'user' as const, content: 'what about closest bars?' },
        { role: 'assistant' as const, content: 'Here are bars near Arlington Heights IL:\n\n1. [Sports Page Bar & Grill Arlington Heights](https://www.sportspagebarandgrill.com/) - Why: listed by source evidence.' },
        { role: 'user' as const, content: 'show me 3 more' },
      ],
      runtime,
    }, searchPlan, descriptors, runtime.tools, {}, {
      ...executeContext,
      action: 'Use AgentBus instructions to answer the current nearby search request.',
      toolPolicy: {
        allowedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });

    expect(searchQueries[0]).toBe('closest bars Arlington Heights IL');
    expect(searchQueries).not.toContain('show me 3 more');
    expect(result.text).toContain("[Peggy Kinnane's Irish Restaurant & Pub](https://www.peggykinnanes.com/)");
    expect(result.text).toContain('[Hey Nonny](https://www.heynonny.com/)');
    expect(result.text).toContain("[Cortland's Garage](https://www.cortlandsgarage.com/)");
    expect(result.text).not.toContain('[Sports Page Bar & Grill Arlington Heights]');
    expect(result.needsUserInput).not.toBe(true);
  });

  it('returns an acknowledged partial follow-up answer when only one of three requested entities can be verified', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'model should not write the final search answer', steps: 1 });
    const searchQueries: string[] = [];
    const busAppend = vi.fn(async (_payload: Payload) => ({ id: 'entry' }));
    const descriptors: ToolDescriptor[] = [
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
        id: 'webmcp:search_web',
        label: 'Search web',
        description: 'Search the web.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
      {
        id: 'webmcp:elicit_user_input',
        label: 'Request user input',
        description: 'Ask the user for missing information.',
        group: 'built-in',
        groupLabel: 'User Context',
      },
    ];
    const runtime: ToolAgentRuntime = {
      tools: {
        'webmcp:recall_user_context': {
          execute: vi.fn(async () => ({ status: 'empty', memories: [] })),
        },
        'webmcp:elicit_user_input': {
          execute: vi.fn(async () => ({ status: 'needs_user_input', prompt: 'missing context' })),
        },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => {
            searchQueries.push(query);
            return {
              status: 'found',
              query,
              results: [{
                title: 'Jimmy D&amp;#x27;s District',
                url: 'https://www.jimmydsdistrict.com/',
                snippet: 'Official page for Jimmy D&amp;#x27;s District, a bar in Arlington Heights, IL.',
              }],
            };
          }),
        },
      } as unknown as ToolSet,
      descriptors,
    };
    const searchPlan: ToolPlan = {
      version: 1,
      goal: 'show me 3 more',
      selectedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
      steps: [],
      createdToolFiles: [],
      actorToolAssignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
    };

    const result = await runConfiguredExecutorAgent({
      ...baseOptions(),
      messages: [
        { role: 'user' as const, content: 'what about closest bars?' },
        { role: 'assistant' as const, content: 'Here are bars near Arlington Heights IL:\n\n1. [Sports Page Bar & Grill Arlington Heights](https://www.sportspagebarandgrill.com/) - Why: listed by source evidence.' },
        { role: 'user' as const, content: 'show me 3 more' },
      ],
      runtime,
    }, searchPlan, descriptors, runtime.tools, {}, {
      ...executeContext,
      bus: { append: busAppend } as unknown as LogActActorExecuteContext['bus'],
      action: 'Use AgentBus instructions to answer the current nearby search request.',
      toolPolicy: {
        allowedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });

    expect(searchQueries).toContain('closest bars Arlington Heights IL');
    expect(searchQueries).not.toContain('show me 3 more');
    expect(result.failed).not.toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.text).toContain('I could only verify 1 additional result for bars');
    expect(result.text).toContain("[Jimmy D's District](https://www.jimmydsdistrict.com/)");
    expect(result.text).not.toContain('&#x27;');
    expect(result.text).not.toContain('&amp;#x27;');
    expect(result.text).not.toContain('[Sports Page Bar & Grill Arlington Heights]');
    const candidatePayloads = busAppend.mock.calls
      .map(([payload]) => payload)
      .filter((payload): payload is Extract<Payload, { type: PayloadType.Result }> => (
        payload.type === PayloadType.Result
        && payload.meta?.actorId === 'search-analyzer'
        && String(payload.intentId).includes('validated-candidates')
      ));
    expect(candidatePayloads).toHaveLength(1);
    expect(candidatePayloads[0].error).toContain('Requested 3 accepted candidates but found 1');
    expect(JSON.parse(candidatePayloads[0].output)).toMatchObject({
      requestedCount: 3,
      acceptedCount: 1,
      missingCount: 2,
    });
  });

  it('decodes HTML entities before using candidate names in follow-up enrichment searches', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'model should not write the final search answer', steps: 1 });
    const searchQueries: string[] = [];
    const descriptors: ToolDescriptor[] = [
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
        id: 'webmcp:search_web',
        label: 'Search web',
        description: 'Search the web.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
      {
        id: 'webmcp:read_web_page',
        label: 'Read web page',
        description: 'Read and extract evidence from a search result page.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
    ];
    const runtime: ToolAgentRuntime = {
      tools: {
        'webmcp:recall_user_context': {
          execute: vi.fn(async () => ({ status: 'empty', memories: [] })),
        },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => {
            searchQueries.push(query);
            if (query.includes("Jimmy D's District")) {
              return {
                status: 'found',
                query,
                results: [{
                  title: "Jimmy D's District - Official Site",
                  url: 'https://www.jimmydsdistrict.com/',
                  snippet: "Official site for Jimmy D's District, a bar in Arlington Heights, IL.",
                }],
              };
            }
            return {
              status: 'found',
              query,
              results: [{
                title: 'Yelp: Best Bars in Arlington Heights, IL',
                url: 'https://example.com/bars',
                snippet: 'Bars near Arlington Heights, IL.',
              }],
            };
          }),
        },
        'webmcp:read_web_page': {
          execute: vi.fn(async ({ url }: { url: string }) => ({
            status: 'read',
            url,
            title: 'Bars near Arlington Heights, IL',
            text: 'Jimmy D&#x27;s District is a bar in Arlington Heights, IL.',
            links: [],
            jsonLd: [],
            entities: [{
              name: 'Jimmy D&amp;#x27;s District',
              evidence: 'Jimmy D&#x27;s District is a bar in Arlington Heights, IL.',
            }],
          })),
        },
      } as unknown as ToolSet,
      descriptors,
    };
    const searchPlan: ToolPlan = {
      version: 1,
      goal: 'show me 3 more',
      selectedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
      steps: [],
      createdToolFiles: [],
      actorToolAssignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
    };

    const result = await runConfiguredExecutorAgent({
      ...baseOptions(),
      messages: [
        { role: 'user' as const, content: 'what about closest bars?' },
        { role: 'assistant' as const, content: 'Here are bars near Arlington Heights IL:\n\n1. [Sports Page Bar & Grill Arlington Heights](https://www.sportspagebarandgrill.com/) - Why: listed by source evidence.' },
        { role: 'user' as const, content: 'show me 3 more' },
      ],
      runtime,
    }, searchPlan, descriptors, runtime.tools, {}, {
      ...executeContext,
      action: 'Use AgentBus instructions to answer the current nearby search request.',
      toolPolicy: {
        allowedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });

    expect(searchQueries).toContain('closest bars Arlington Heights IL');
    expect(searchQueries).toContain('"Jimmy D\'s District" Arlington Heights IL bars official reviews');
    expect(searchQueries.some((query) => query.includes('&#x27;') || query.includes('&amp;#x27;'))).toBe(false);
    expect(result.text).toContain("[Jimmy D's District](https://www.jimmydsdistrict.com/)");
  });

  it('rejects article metadata and page chrome when a follow-up switches from movie theaters to bars', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'model should not write the final search answer', steps: 1 });
    const searchQueries: string[] = [];
    const descriptors: ToolDescriptor[] = [
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
        id: 'webmcp:search_web',
        label: 'Search web',
        description: 'Search the web.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
      {
        id: 'webmcp:read_web_page',
        label: 'Read web page',
        description: 'Read and extract evidence from a search result page.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
    ];
    const runtime: ToolAgentRuntime = {
      tools: {
        'webmcp:recall_user_context': {
          execute: vi.fn(async () => ({ status: 'empty', memories: [] })),
        },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => {
            searchQueries.push(query);
            if (/bars names near Arlington Heights IL/i.test(query)) {
              return {
                status: 'found',
                query,
                results: [
                  {
                    title: 'Sports Page Bar & Grill Arlington Heights - Official Site',
                    url: 'https://www.sportspagebarandgrill.com/',
                    snippet: 'Sports Page Bar & Grill is a bar in Arlington Heights, IL.',
                  },
                  {
                    title: 'Bar Salotto - Official Site',
                    url: 'https://www.barsalotto.com/',
                    snippet: 'Bar Salotto is a cocktail bar in Arlington Heights, IL.',
                  },
                  {
                    title: "Jimmy D's District - Official Site",
                    url: 'https://www.jimmydsdistrict.com/',
                    snippet: "Jimmy D's District is a bar in Arlington Heights, IL.",
                  },
                ],
              };
            }
            if (/Sports Page Bar & Grill|Bar Salotto|Jimmy D's District/i.test(query)) {
              const name = query.match(/"([^"]+)"/)?.[1] ?? 'Bar';
              const url = name.includes('Sports Page')
                ? 'https://www.sportspagebarandgrill.com/'
                : name.includes('Bar Salotto')
                  ? 'https://www.barsalotto.com/'
                  : 'https://www.jimmydsdistrict.com/';
              return {
                status: 'found',
                query,
                results: [{
                  title: `${name} - Official Site`,
                  url,
                  snippet: `${name} is a bar in Arlington Heights, IL.`,
                }],
              };
            }
            return {
              status: 'found',
              query,
              results: [
                {
                  title: 'Yelp: Best Bars in Arlington Heights, IL',
                  url: 'https://www.yelp.com/search?cflt=bars&find_loc=Arlington+Heights,+IL',
                  snippet: 'Best bars in Arlington Heights, IL.',
                },
                {
                  title: "Chicago Bound: Arlington Heights' Best Bars",
                  url: 'https://chicagobound.com/best-bars-in-arlington-heights-il',
                  snippet: 'Guide to bars in Arlington Heights, IL.',
                },
              ],
            };
          }),
        },
        'webmcp:read_web_page': {
          execute: vi.fn(async ({ url }: { url: string }) => ({
            status: 'read',
            url,
            title: "Arlington Heights' Best Bars Spots [2026 Guide]",
            text: [
              'Chicago Bound Shop Categories About Us Support Enable dark mode Join Now Enable dark mode.',
              '{"@context":"https://schema.org","@type":"Article","headline":"Arlington Heights Best Bars Spots [2026 Guide]","author":{"@type":"Person","name":"Chicago Bound"}}',
              'Bars Arlington Heights Best Bars Spots 2026 Guide A Alex Irvin Published 2023-05-25.',
            ].join(' '),
            links: [
              { text: 'Support Enable', url: 'https://chicagobound.com/support' },
              { text: 'Join Now Enable', url: 'https://chicagobound.com/join' },
              { text: 'Chicago Bound', url: 'https://chicagobound.com/' },
            ],
            jsonLd: [{
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: "Arlington Heights' Best Bars Spots [2026 Guide]",
              author: { '@type': 'Person', name: 'Chicago Bound', url: 'https://chicagobound.com' },
              publisher: { '@type': 'Organization', name: 'Chicago Bound', url: 'https://chicagobound.com' },
            }],
            entities: [
              {
                name: 'Support Enable',
                url: 'https://chicagobound.com/support',
                evidence: 'Chicago Bound Shop Categories About Us Support Enable dark mode Join Now Enable dark mode.',
              },
              {
                name: 'Join Now Enable',
                url: 'https://chicagobound.com/join',
                evidence: 'Chicago Bound Shop Categories About Us Support Enable dark mode Join Now Enable dark mode.',
              },
              {
                name: 'Chicago Bound',
                url: 'https://chicagobound.com/',
                evidence: '{"@context":"https://schema.org","@type":"Article","headline":"Arlington Heights Best Bars Spots [2026 Guide]","author":{"@type":"Person","name":"Chicago Bound"}}',
              },
            ],
            observations: [],
          })),
        },
      } as unknown as ToolSet,
      descriptors,
    };
    const searchPlan: ToolPlan = {
      version: 1,
      goal: 'what about bars?',
      selectedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
      steps: [],
      createdToolFiles: [],
      actorToolAssignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
    };

    const result = await runConfiguredExecutorAgent({
      ...baseOptions(),
      messages: [
        { role: 'user' as const, content: "what're the best movie theaters near me?" },
        { role: 'assistant' as const, content: 'Here are movie theaters near Arlington Heights IL:\n\n1. [AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12) - Why: listed by source evidence.' },
        {
          role: 'system' as const,
          content: 'Agent Browser search turn context:\n{"taskText":"what are the best movie theaters near me?","resolvedTaskText":"best movie theaters Arlington Heights IL","subject":"movie theaters","answerSubject":"movie theaters","rankingGoal":"best","location":"Arlington Heights, IL","acceptedCandidates":[{"name":"AMC Randhurst 12","url":"https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12"}],"rejectedLabels":[],"sourceQueries":["best movie theaters Arlington Heights IL"],"requestedCount":1,"timestamp":1}',
        },
        { role: 'user' as const, content: 'what about bars?' },
      ],
      runtime,
    }, searchPlan, descriptors, runtime.tools, {}, {
      ...executeContext,
      action: 'Use AgentBus instructions to answer the current nearby search request.',
      toolPolicy: {
        allowedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });

    expect(searchQueries.some((query) => /^bars Arlington Heights IL$/i.test(query))).toBe(true);
    expect(searchQueries).toContain('bars names near Arlington Heights IL');
    expect(searchQueries.join('\n')).not.toMatch(/movie theaters|Support Enable|Join Now Enable|Chicago Bound Shop/i);
    expect(result.failed).not.toBe(true);
    expect(result.text).toContain('[Sports Page Bar & Grill Arlington Heights](https://www.sportspagebarandgrill.com/)');
    expect(result.text).toContain('[Bar Salotto](https://www.barsalotto.com/)');
    expect(result.text).toContain("[Jimmy D's District](https://www.jimmydsdistrict.com/)");
    expect(result.text).not.toMatch(/Support Enable|Join Now Enable|Chicago Bound Shop|Chicago Bound - Why|Best Bars Spots|movie theaters/i);
  });

  it('counts three additional source-backed follow-up entities even when a brand contains a generic word', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'model should not write the final search answer', steps: 1 });
    const searchQueries: string[] = [];
    const busAppend = vi.fn(async (_payload: Payload) => ({ id: 'entry' }));
    const descriptors: ToolDescriptor[] = [
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
        id: 'webmcp:search_web',
        label: 'Search web',
        description: 'Search the web.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
      {
        id: 'webmcp:read_web_page',
        label: 'Read web page',
        description: 'Read and extract evidence from a search result page.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
    ];
    const runtime: ToolAgentRuntime = {
      tools: {
        'webmcp:recall_user_context': {
          execute: vi.fn(async () => ({
            status: 'found',
            query: 'location',
            memories: [{
              id: 'location.city',
              label: 'Saved city',
              value: 'Arlington Heights, IL',
              source: 'workspace-memory',
              updatedAt: '2026-04-26T00:00:00.000Z',
            }],
          })),
        },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => {
            searchQueries.push(query);
            return {
              status: 'found',
              query,
              results: [{
                title: 'best bookstores near Arlington Heights, IL - Source Directory',
                url: 'https://fixtures.agent-browser.test/bookstores/best/listing',
                snippet: 'Source listing for bookstores near Arlington Heights, IL. Read the page to validate entity names.',
              }],
            };
          }),
        },
        'webmcp:read_web_page': {
          execute: vi.fn(async ({ url }: { url: string }) => ({
            status: 'read',
            url,
            title: 'bookstores near Arlington Heights, IL',
            text: [
              'Bookstores near Arlington Heights, IL.',
              'Barnes & Noble Arlington Heights is a bookstore with source-backed location evidence in Arlington Heights.',
              'Half Price Books Palatine is a bookstore with source-backed location evidence in Palatine near Arlington Heights.',
              'The Book Stall is a bookstore with source-backed location evidence in Winnetka near Arlington Heights.',
            ].join(' '),
            links: [
              {
                text: 'At Home',
                url: 'https://fixtures.agent-browser.test/chrome/at-home',
              },
              {
                text: 'Barnes & Noble Arlington Heights',
                url: 'https://stores.barnesandnoble.com/store/2089',
              },
              {
                text: 'Half Price Books Palatine',
                url: 'https://www.hpb.com/store?storeid=HPB-032',
              },
              {
                text: 'The Book Stall',
                url: 'https://www.thebookstall.com/',
              },
            ],
            jsonLd: [],
            entities: [
              {
                name: 'At Home',
                url: 'https://fixtures.agent-browser.test/chrome/at-home',
                evidence: 'page navigation or content bucket link',
              },
              {
                name: 'Barnes & Noble Arlington Heights',
                url: 'https://stores.barnesandnoble.com/store/2089',
                evidence: 'bookstore with source-backed location evidence in Arlington Heights',
              },
              {
                name: 'Half Price Books Palatine',
                url: 'https://www.hpb.com/store?storeid=HPB-032',
                evidence: 'bookstore with source-backed location evidence in Palatine near Arlington Heights',
              },
              {
                name: 'The Book Stall',
                url: 'https://www.thebookstall.com/',
                evidence: 'bookstore with source-backed location evidence in Winnetka near Arlington Heights',
              },
            ],
          })),
        },
      } as unknown as ToolSet,
      descriptors,
    };
    const searchPlan: ToolPlan = {
      version: 1,
      goal: 'show me 3 more',
      selectedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
      steps: [],
      createdToolFiles: [],
      actorToolAssignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
    };

    const result = await runConfiguredExecutorAgent({
      ...baseOptions(),
      messages: [
        { role: 'user' as const, content: 'what are the best bookstores near me?' },
        { role: 'assistant' as const, content: 'Here are bookstores near Arlington Heights IL:\n\n1. [Anderson Bookshop Arlington Heights](https://example.com/anderson) - Why: listed by source evidence.' },
        { role: 'user' as const, content: 'show me 3 more' },
      ],
      runtime,
    }, searchPlan, descriptors, runtime.tools, {}, {
      ...executeContext,
      bus: { append: busAppend } as unknown as LogActActorExecuteContext['bus'],
      action: 'Use AgentBus instructions to answer the current nearby search request.',
      toolPolicy: {
        allowedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });

    expect(searchQueries[0]).toBe('best bookstores Arlington Heights IL');
    expect(searchQueries).not.toContain('show me 3 more');
    expect(result.failed).not.toBe(true);
    expect(result.text).toContain('[Barnes & Noble Arlington Heights](https://stores.barnesandnoble.com/store/2089)');
    expect(result.text).toContain('[Half Price Books Palatine](https://www.hpb.com/store?storeid=HPB-032)');
    expect(result.text).toContain('[The Book Stall](https://www.thebookstall.com/)');
    expect(result.text).not.toContain('[Anderson Bookshop Arlington Heights]');
    const candidatePayload = busAppend.mock.calls
      .map(([payload]) => payload)
      .filter((payload): payload is Extract<Payload, { type: PayloadType.Result }> => (
        payload.type === PayloadType.Result
        && payload.meta?.actorId === 'search-analyzer'
        && String(payload.intentId).includes('validated-candidates')
      ))
      .at(-1);
    expect(JSON.parse(candidatePayload?.output ?? '{}')).toMatchObject({
      requestedCount: 3,
      acceptedCount: 3,
      missingCount: 0,
    });
  });

  it('normalizes browser coordinates and recovers from movie-time directory labels for theater searches', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'model should not write the final theater answer', steps: 1 });
    const searchQueries: string[] = [];
    const busAppend = vi.fn(async (_payload: Payload) => ({ id: 'entry' }));
    const descriptors: ToolDescriptor[] = [
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
        id: 'webmcp:search_web',
        label: 'Search web',
        description: 'Search the web for local theater results.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
      {
        id: 'webmcp:read_web_page',
        label: 'Read web page',
        description: 'Read and extract evidence from a search result page.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
    ];
    const runtime: ToolAgentRuntime = {
      tools: {
        'webmcp:recall_user_context': {
          execute: vi.fn(async () => ({ status: 'empty', query: 'location', memories: [] })),
        },
        'webmcp:read_browser_location': {
          execute: vi.fn(async () => ({
            status: 'available',
            latitude: 42.11713258868569,
            longitude: -87.9912774939386,
            accuracy: 24,
          })),
        },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => {
            searchQueries.push(query);
            if (query === 'city state for coordinates 42.12 -87.99') {
              return {
                status: 'found',
                query,
                results: [{
                  title: 'Arlington Heights, Illinois - coordinate lookup',
                  url: 'https://fixtures.agent-browser.test/geocode/arlington-heights',
                  snippet: 'The coordinates 42.12, -87.99 resolve to Arlington Heights, Illinois, United States.',
                }],
              };
            }
            if (query === 'nearby theaters Arlington Heights IL') {
              return {
                status: 'found',
                query,
                results: [
                  {
                    title: 'Movie Times and Movie Theaters in Arlington Heights, IL - Fandango',
                    url: 'https://www.fandango.com/arlington-heights_il_movietimes',
                    snippet: 'Find movie times and movie theaters near Arlington Heights, IL.',
                  },
                  {
                    title: 'Movie Times by Cities and States - Showtimes',
                    url: 'https://www.showtimes.com/movie-times/',
                    snippet: 'Browse movie times by cities, states, and zip codes.',
                  },
                ],
              };
            }
            if (query === 'theaters names near Arlington Heights IL') {
              return {
                status: 'found',
                query,
                results: [
                  {
                    title: 'AMC Randhurst 12',
                    url: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12',
                    snippet: 'AMC Randhurst 12 is a movie theater in Mount Prospect near Arlington Heights, IL.',
                  },
                  {
                    title: 'CMX Arlington Heights',
                    url: 'https://www.cmxcinemas.com/location/cmx-arlington-heights',
                    snippet: 'CMX Arlington Heights is a cinema in Arlington Heights, IL.',
                  },
                  {
                    title: 'Classic Cinemas Elk Grove Theatre',
                    url: 'https://www.classiccinemas.com/location/elk-grove-theatre',
                    snippet: 'Classic Cinemas Elk Grove Theatre is a movie theater near Arlington Heights, IL.',
                  },
                ],
              };
            }
            return { status: 'empty', query, results: [] };
          }),
        },
        'webmcp:read_web_page': {
          execute: vi.fn(async ({ url }: { url: string }) => ({
            status: 'read',
            url,
            title: 'Movie theaters near Arlington Heights, IL',
            text: [
              'Movie Times by Cities',
              'Cities Movie Times',
              'Movie Times by States',
              'States Movie Times',
              'Movie Times by Zip Codes',
              'Zip Codes Movie Times',
            ].join(' '),
            links: [
              { text: 'Cities Movie Times', url: 'https://www.fandango.com/movies-by-city' },
              { text: 'States Movie Times', url: 'https://www.fandango.com/movies-by-state' },
              { text: 'Zip Codes Movie Times', url: 'https://www.fandango.com/movies-by-zip-code' },
            ],
            jsonLd: [],
            entities: [
              { name: 'Cities Movie Times', url: 'https://www.fandango.com/movies-by-city', evidence: 'Movie Times by Cities' },
              { name: 'States Movie Times', url: 'https://www.fandango.com/movies-by-state', evidence: 'Movie Times by States' },
              { name: 'Zip Codes Movie Times', url: 'https://www.fandango.com/movies-by-zip-code', evidence: 'Movie Times by Zip Codes' },
            ],
            observations: [
              {
                kind: 'page-link',
                label: 'Cities Movie Times',
                url: 'https://www.fandango.com/movies-by-city',
                evidence: 'page link',
                localContext: 'Movie Times by Cities',
                sourceUrl: url,
              },
              {
                kind: 'page-link',
                label: 'States Movie Times',
                url: 'https://www.fandango.com/movies-by-state',
                evidence: 'page link',
                localContext: 'Movie Times by States',
                sourceUrl: url,
              },
              {
                kind: 'page-link',
                label: 'Zip Codes Movie Times',
                url: 'https://www.fandango.com/movies-by-zip-code',
                evidence: 'page link',
                localContext: 'Movie Times by Zip Codes',
                sourceUrl: url,
              },
            ],
          })),
        },
      } as unknown as ToolSet,
      descriptors,
    };
    const searchPlan: ToolPlan = {
      version: 1,
      goal: 'show me theaters near me',
      selectedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
      steps: [],
      createdToolFiles: [],
      actorToolAssignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
    };

    const result = await runConfiguredExecutorAgent({
      ...baseOptions(),
      messages: [{ role: 'user' as const, content: 'show me theaters near me' }],
      runtime,
    }, searchPlan, descriptors, runtime.tools, {}, {
      ...executeContext,
      bus: { append: busAppend } as unknown as LogActActorExecuteContext['bus'],
      action: 'Use AgentBus instructions to answer the current nearby theater request.',
      toolPolicy: {
        allowedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: {
          executor: descriptors.map((toolDescriptor) => toolDescriptor.id),
          'web-search-agent': descriptors.map((toolDescriptor) => toolDescriptor.id),
        },
      },
    });

    expect(searchQueries[0]).toBe('city state for coordinates 42.12 -87.99');
    expect(searchQueries).toContain('nearby theaters Arlington Heights IL');
    expect(searchQueries).toContain('theaters names near Arlington Heights IL');
    expect(searchQueries.join('\n')).not.toMatch(/42\.11713258868569|-87\.9912774939386|Cities Movie Times|States Movie Times|Zip Codes Movie Times/);
    expect(result.failed).not.toBe(true);
    expect(result.text).toContain('Here are theaters near Arlington Heights, IL');
    expect(result.text).toContain('[AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12)');
    expect(result.text).toContain('[CMX Arlington Heights](https://www.cmxcinemas.com/location/cmx-arlington-heights)');
    expect(result.text).toContain('[Classic Cinemas Elk Grove Theatre](https://www.classiccinemas.com/location/elk-grove-theatre)');
    expect(result.text).not.toMatch(/42\.11713258868569|-87\.9912774939386|Cities Movie Times|States Movie Times|Zip Codes Movie Times/);
    const candidatePayload = busAppend.mock.calls
      .map(([payload]) => payload)
      .filter((payload): payload is Extract<Payload, { type: PayloadType.Result }> => (
        payload.type === PayloadType.Result
        && payload.meta?.actorId === 'search-analyzer'
        && String(payload.intentId).includes('validated-candidates')
      ))
      .at(-1);
    const validation = JSON.parse(candidatePayload?.output ?? '{}') as {
      candidates?: Array<{ name: string; validationStatus: string }>;
      rejected?: Array<{ name: string; validationStatus: string }>;
    };
    expect(validation.candidates?.map((candidate) => candidate.name)).toEqual(expect.arrayContaining([
      'AMC Randhurst 12',
      'CMX Arlington Heights',
      'Classic Cinemas Elk Grove Theatre',
    ]));
    expect(validation.candidates?.every((candidate) => candidate.validationStatus === 'accepted')).toBe(true);
    expect(validation.rejected?.map((candidate) => candidate.name)).toEqual(expect.arrayContaining([
      'Cities Movie Times',
      'States Movie Times',
      'Zip Codes Movie Times',
    ]));
  });

  it('applies arbitrary compiled name-prefix constraints before composing search answers', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'model should not write the final search answer', steps: 1 });
    const searchQueries: string[] = [];
    const descriptors: ToolDescriptor[] = [
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
        id: 'webmcp:search_web',
        label: 'Search web',
        description: 'Search the web.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
      {
        id: 'webmcp:read_web_page',
        label: 'Read web page',
        description: 'Read and extract evidence from a search result page.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
    ];
    const runtime: ToolAgentRuntime = {
      tools: {
        'webmcp:recall_user_context': {
          execute: vi.fn(async () => ({ status: 'empty', memories: [] })),
        },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => {
            searchQueries.push(query);
            return {
              status: 'found',
              query,
              results: [{
                title: 'Shops in the Vatican starting with A',
                url: 'https://fixtures.agent-browser.test/vatican-shops',
                snippet: 'Vatican shops include Alpha Gifts and Basilica Books.',
              }],
            };
          }),
        },
        'webmcp:read_web_page': {
          execute: vi.fn(async ({ url }: { url: string }) => ({
            status: 'read',
            url,
            title: 'Shops in the Vatican',
            text: [
              'Alpha Gifts is a shop in the Vatican with source-backed visitor information.',
              'Basilica Books is a shop in the Vatican with source-backed visitor information.',
            ].join(' '),
            links: [
              { text: 'Alpha Gifts', url: 'https://fixtures.agent-browser.test/alpha-gifts' },
              { text: 'Basilica Books', url: 'https://fixtures.agent-browser.test/basilica-books' },
            ],
            jsonLd: [],
            entities: [
              {
                name: 'Alpha Gifts',
                url: 'https://fixtures.agent-browser.test/alpha-gifts',
                evidence: 'Alpha Gifts is a shop in the Vatican with source-backed visitor information.',
              },
              {
                name: 'Basilica Books',
                url: 'https://fixtures.agent-browser.test/basilica-books',
                evidence: 'Basilica Books is a shop in the Vatican with source-backed visitor information.',
              },
            ],
          })),
        },
      } as unknown as ToolSet,
      descriptors,
    };
    const searchPlan: ToolPlan = {
      version: 1,
      goal: 'provide shops in the Vatican that start with the letter A',
      selectedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
      steps: [],
      createdToolFiles: [],
      actorToolAssignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
    };

    const result = await runConfiguredExecutorAgent({
      ...baseOptions(),
      messages: [{ role: 'user' as const, content: 'provide shops in the Vatican that start with the letter A' }],
      runtime,
    }, searchPlan, descriptors, runtime.tools, {}, {
      ...executeContext,
      action: 'Use AgentBus instructions to answer the current constrained search request.',
      toolPolicy: {
        allowedToolIds: descriptors.map((toolDescriptor) => toolDescriptor.id),
        assignments: { executor: descriptors.map((toolDescriptor) => toolDescriptor.id) },
      },
    });

    expect(searchQueries[0]).toContain('shops');
    expect(searchQueries[0]).toContain('Vatican');
    expect(searchQueries[0]).toContain('starts with A');
    expect(result.text).toContain('[Alpha Gifts](https://fixtures.agent-browser.test/alpha-gifts)');
    expect(result.text).not.toContain('Basilica Books');
  });
});
