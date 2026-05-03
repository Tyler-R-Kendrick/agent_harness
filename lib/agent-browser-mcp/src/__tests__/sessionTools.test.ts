import { describe, expect, it, vi } from 'vitest';
import { getModelContextRegistry, ModelContext } from '@agent-harness/webmcp';

import { createWebMcpTool } from '../tool';
import { registerSessionTools } from '../workspaceTools';

describe('registerSessionTools', () => {
  it('registers focused session tools for the active session', async () => {
    const modelContext = new ModelContext();
    const sessionTools = [
      {
        id: 'cli',
        label: 'CLI',
        description: 'Run shell commands in the active session.',
        group: 'local',
        groupLabel: 'Local tools',
      },
      {
        id: 'webmcp:list_filesystem_entries',
        label: 'List filesystem entries',
        description: 'List or search files, folders, and drives.',
        group: 'files-worktree-mcp',
        groupLabel: 'Files Worktree MCP',
      },
    ];
    const onWriteSession = vi.fn(async ({
      sessionId,
      message,
      provider,
      modelId,
      agentId,
      toolIds,
      mode,
    }: {
      sessionId: string;
      message?: string;
      provider?: string;
      modelId?: string;
      agentId?: string | null;
      toolIds?: readonly string[];
      mode?: 'agent' | 'terminal';
    }) => ({
      id: sessionId,
      name: 'Ops Session',
      mode: mode ?? 'terminal',
      provider: provider ?? 'ghcp',
      modelId: modelId ?? 'gpt-4.1',
      agentId: agentId ?? null,
      toolIds: toolIds ?? [],
      cwd: '/workspace/app',
      messages: [
        { role: 'system' as const, content: 'Active workspace: Research' },
        { role: 'user' as const, content: message ?? 'hello' },
      ],
    }));

    registerSessionTools(modelContext, {
      workspaceName: 'Research',
      session: {
        id: 'session-1',
        name: 'Session 1',
        isOpen: true,
        mode: 'agent',
        provider: 'codi',
        modelId: 'qwen3-0.6b',
        agentId: null,
        cwd: '/workspace',
        messages: [
          { role: 'system', content: 'Active workspace: Research' },
          { role: 'user', content: 'Summarize the plan.' },
        ],
      },
      sessionTools,
      onWriteSession,
    });

    const webmcpTool = createWebMcpTool(modelContext);

    await expect(webmcpTool.execute?.({ tool: 'read_session' }, {} as never)).resolves.toEqual({
      workspaceName: 'Research',
      id: 'session-1',
      name: 'Session 1',
      mode: 'agent',
      provider: 'codi',
      modelId: 'qwen3-0.6b',
      agentId: null,
      toolIds: [],
      cwd: '/workspace',
      messages: [
        { role: 'system', content: 'Active workspace: Research' },
        { role: 'user', content: 'Summarize the plan.' },
      ],
    });

    await expect(webmcpTool.execute?.({
      tool: 'list_session_tools',
      args: {
        query: 'shell',
      },
    }, {} as never)).resolves.toEqual([
      {
        id: 'cli',
        label: 'CLI',
        description: 'Run shell commands in the active session.',
        group: 'local',
        groupLabel: 'Local tools',
        selected: false,
      },
    ]);

    await expect(webmcpTool.execute?.({
      tool: 'submit_session_message',
      args: {
        sessionId: 'session-1',
        message: 'Open the terminal and inspect the repo.',
      },
    }, {} as never)).resolves.toEqual({
      workspaceName: 'Research',
      id: 'session-1',
      name: 'Ops Session',
      mode: 'terminal',
      provider: 'ghcp',
      modelId: 'gpt-4.1',
      agentId: null,
      toolIds: [],
      cwd: '/workspace/app',
      messages: [
        { role: 'system', content: 'Active workspace: Research' },
        { role: 'user', content: 'Open the terminal and inspect the repo.' },
      ],
    });
    expect(onWriteSession).toHaveBeenNthCalledWith(1, {
      sessionId: 'session-1',
      message: 'Open the terminal and inspect the repo.',
    });

    await expect(webmcpTool.execute?.({
      tool: 'submit_session_message',
      args: {
        sessionId: 'session-1',
        message: '   ',
      },
    }, {} as never)).rejects.toThrow('message');

    await expect(webmcpTool.execute?.({
      tool: 'change_session_model',
      args: {
        sessionId: 'session-1',
      provider: 'ghcp',
      modelId: 'gpt-4.1',
      },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      provider: 'ghcp',
      modelId: 'gpt-4.1',
    }));
    expect(onWriteSession).toHaveBeenNthCalledWith(2, {
      sessionId: 'session-1',
      provider: 'ghcp',
      modelId: 'gpt-4.1',
    });

    await expect(webmcpTool.execute?.({
      tool: 'switch_session_mode',
      args: {
        sessionId: 'session-1',
        mode: 'terminal',
      },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      mode: 'terminal',
    }));
    expect(onWriteSession).toHaveBeenNthCalledWith(3, {
      sessionId: 'session-1',
      mode: 'terminal',
    });

    await expect(webmcpTool.execute?.({
      tool: 'switch_session_mode',
      args: {
        sessionId: 'session-1',
        mode: 'sideways',
      },
    }, {} as never)).rejects.toThrow('mode');

    await expect(webmcpTool.execute?.({
      tool: 'change_session_model',
      args: {
        sessionId: 'session-1',
        modelId: 'gpt-4o-mini',
      },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      provider: 'ghcp',
      modelId: 'gpt-4o-mini',
    }));
    expect(onWriteSession).toHaveBeenNthCalledWith(4, {
      sessionId: 'session-1',
      modelId: 'gpt-4o-mini',
    });

    await expect(webmcpTool.execute?.({
      tool: 'change_session_tools',
      args: {
        sessionId: 'session-1',
        action: 'select',
        toolIds: ['cli'],
      },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      toolIds: ['cli'],
    }));
    expect(onWriteSession).toHaveBeenNthCalledWith(5, {
      sessionId: 'session-1',
      toolIds: ['cli'],
    });

    await expect(webmcpTool.execute?.({
      tool: 'read_session',
      args: { sessionId: 'session-2' },
    }, {} as never)).rejects.toThrow('active session');
  });

  it('registers only read_session when session mutations are unavailable', () => {
    const modelContext = new ModelContext();

    registerSessionTools(modelContext, {
      workspaceName: 'Research',
      session: {
        id: 'session-1',
        name: 'Session 1',
        isOpen: true,
        mode: 'agent',
        provider: 'codi',
        modelId: 'qwen3-0.6b',
        agentId: null,
        toolIds: [],
        cwd: '/workspace',
        messages: [],
      },
    });

    expect(getModelContextRegistry(modelContext).list().map(({ name }) => name)).toEqual(['read_session']);
  });

  it('omits change_session_tools when no session tool catalog is available', () => {
    const modelContext = new ModelContext();

    registerSessionTools(modelContext, {
      workspaceName: 'Research',
      session: {
        id: 'session-1',
        name: 'Session 1',
        isOpen: true,
        mode: 'agent',
        provider: 'codi',
        modelId: 'qwen3-0.6b',
        agentId: null,
        toolIds: [],
        cwd: '/workspace',
        messages: [],
      },
      onWriteSession: vi.fn(),
    });

    expect(getModelContextRegistry(modelContext).list().map(({ name }) => name)).toEqual([
      'read_session',
      'submit_session_message',
      'change_session_model',
      'switch_session_mode',
    ]);
  });
});
