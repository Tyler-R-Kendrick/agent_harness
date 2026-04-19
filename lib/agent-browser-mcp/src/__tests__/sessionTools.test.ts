import { describe, expect, it, vi } from 'vitest';
import { ModelContext } from '../../../webmcp/src/index';

import { createWebMcpTool } from '../tool';
import { registerSessionTools } from '../workspaceTools';

describe('registerSessionTools', () => {
  it('registers read_session and write_session for the active session', async () => {
    const modelContext = new ModelContext();
    const onWriteSession = vi.fn(async ({
      sessionId,
      name,
      message,
      provider,
      modelId,
      mode,
      cwd,
    }: {
      sessionId: string;
      name?: string;
      message?: string;
      provider?: string;
      modelId?: string;
      mode?: 'agent' | 'terminal';
      cwd?: string;
    }) => ({
      id: sessionId,
      name: name ?? 'Ops Session',
      mode: mode ?? 'terminal',
      provider: provider ?? 'ghcp',
      modelId: modelId ?? 'gpt-4.1',
      cwd: cwd ?? '/workspace/app',
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
        mode: 'agent',
        provider: 'codi',
        modelId: 'qwen3-0.6b',
        cwd: '/workspace',
        messages: [
          { role: 'system', content: 'Active workspace: Research' },
          { role: 'user', content: 'Summarize the plan.' },
        ],
      },
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
      cwd: '/workspace',
      messages: [
        { role: 'system', content: 'Active workspace: Research' },
        { role: 'user', content: 'Summarize the plan.' },
      ],
    });

    await expect(webmcpTool.execute?.({
      tool: 'write_session',
      args: {
        sessionId: 'session-1',
        name: 'Ops Session',
        message: 'Open the terminal and inspect the repo.',
        provider: 'ghcp',
        modelId: 'gpt-4.1',
        mode: 'terminal',
        cwd: '/workspace/app',
      },
    }, {} as never)).resolves.toEqual({
      workspaceName: 'Research',
      id: 'session-1',
      name: 'Ops Session',
      mode: 'terminal',
      provider: 'ghcp',
      modelId: 'gpt-4.1',
      cwd: '/workspace/app',
      messages: [
        { role: 'system', content: 'Active workspace: Research' },
        { role: 'user', content: 'Open the terminal and inspect the repo.' },
      ],
    });
    expect(onWriteSession).toHaveBeenCalledWith({
      sessionId: 'session-1',
      name: 'Ops Session',
      message: 'Open the terminal and inspect the repo.',
      provider: 'ghcp',
      modelId: 'gpt-4.1',
      mode: 'terminal',
      cwd: '/workspace/app',
    });

    await expect(webmcpTool.execute?.({
      tool: 'read_session',
      args: { sessionId: 'session-2' },
    }, {} as never)).rejects.toThrow('active session');
  });
});