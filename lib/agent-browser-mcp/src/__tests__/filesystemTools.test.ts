import { ModelContext } from '@agent-harness/webmcp';
import { describe, expect, it, vi } from 'vitest';

import { registerFilesystemTools } from '../filesystemTools';
import { createWebMcpTool } from '../tool';

describe('registerFilesystemTools', () => {
  it('hides session filesystem entries after their drive is unmounted unless explicitly requested', async () => {
    const modelContext = new ModelContext();
    const onMountSessionDrive = vi.fn(async (sessionId: string) => ({
      sessionId,
      label: '//session-1-fs',
      mounted: true,
    }));
    const onUnmountSessionDrive = vi.fn(async (sessionId: string) => ({
      sessionId,
      label: '//session-1-fs',
      mounted: false,
    }));
    const sessionEntries = [
      {
        targetType: 'session-fs-entry',
        sessionId: 'session-1',
        path: '/workspace',
        kind: 'folder',
        label: 'workspace',
        isRoot: true,
      },
      {
        targetType: 'session-fs-entry',
        sessionId: 'session-1',
        path: '/workspace/notes.md',
        kind: 'file',
        label: 'notes.md',
        isRoot: false,
      },
    ];

    registerFilesystemTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      sessionDrives: [{ sessionId: 'session-1', label: '//session-1-fs', mounted: true }],
      sessionFsEntries: [
        { sessionId: 'session-1', path: '/workspace', kind: 'folder', isRoot: true },
        { sessionId: 'session-1', path: '/workspace/notes.md', kind: 'file', content: 'Ship it.' },
      ],
      onMountSessionDrive,
      onUnmountSessionDrive,
    });

    const webmcpTool = createWebMcpTool(modelContext);
    const listSessionEntries = (args: Record<string, unknown> = {}) => webmcpTool.execute?.({
      tool: 'list_filesystem_entries',
      args: { targetType: 'session-fs-entry', sessionId: 'session-1', ...args },
    }, {} as never);

    await expect(listSessionEntries()).resolves.toEqual(sessionEntries);

    await expect(webmcpTool.execute?.({
      tool: 'change_filesystem_mount',
      args: { action: 'unmount', sessionId: 'session-1' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'unmount',
      targetType: 'session-drive',
      sessionId: 'session-1',
      mounted: false,
    }));

    await expect(listSessionEntries()).resolves.toEqual([]);
    await expect(listSessionEntries({ includeUnmounted: true })).resolves.toEqual(sessionEntries);
    expect(onUnmountSessionDrive).toHaveBeenCalledWith('session-1');

    await expect(webmcpTool.execute?.({
      tool: 'change_filesystem_mount',
      args: { action: 'mount', sessionId: 'session-1' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'mount',
      targetType: 'session-drive',
      sessionId: 'session-1',
      mounted: true,
    }));

    await expect(listSessionEntries()).resolves.toEqual(sessionEntries);
    expect(onMountSessionDrive).toHaveBeenCalledWith('session-1');
  });
});
