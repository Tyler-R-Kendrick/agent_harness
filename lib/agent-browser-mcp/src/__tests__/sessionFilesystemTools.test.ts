import { describe, expect, it, vi } from 'vitest';
import { getModelContextRegistry, ModelContext } from '@agent-harness/webmcp';
import { registerSessionFilesystemTools } from '../sessionFilesystemTools';
import { createWebMcpTool } from '../tool';

const SESSION_DRIVES = [
  { sessionId: 'session-1', label: 'Session 1', mounted: true },
  { sessionId: 'session-2', label: 'Session 2', mounted: false },
];

const VISIBLE_SESSION_DRIVES = [
  { sessionId: 'session-1', label: '//session-1-fs', mounted: true },
];

const MULTI_VISIBLE_SESSION_DRIVES = [
  { sessionId: 'session-1', label: '//session-1-fs', mounted: true },
  { sessionId: 'session-2', label: '//session-2-fs', mounted: true },
];

const SESSION_FS_ENTRIES = [
  { sessionId: 'session-1', path: '/', kind: 'folder' as const, isRoot: true },
  { sessionId: 'session-1', path: '/notes', kind: 'folder' as const },
  { sessionId: 'session-1', path: '/notes/hello.txt', kind: 'file' as const, content: 'Hello!' },
  { sessionId: 'session-1', path: '/readme.md', kind: 'file' as const, content: '# Readme' },
];

describe('registerSessionFilesystemTools', () => {
  it('registers no tools when no session data or callbacks are provided', () => {
    const modelContext = new ModelContext();
    registerSessionFilesystemTools(modelContext, { workspaceName: 'Research' });
    expect(getModelContextRegistry(modelContext).list()).toHaveLength(0);
  });

  it('registers list_session_drives when session drives are provided', async () => {
    const modelContext = new ModelContext();
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionDrives: SESSION_DRIVES,
    });

    const tool = createWebMcpTool(modelContext);
    const listed = await tool.execute?.({ tool: 'list_session_drives' }, {} as never);
    // Sorted by label
    expect(listed).toEqual([SESSION_DRIVES[0], SESSION_DRIVES[1]]);
  });

  it('registers mount/unmount tools when callbacks are provided', async () => {
    const modelContext = new ModelContext();
    const onMountSessionDrive = vi.fn(async () => undefined);
    const onUnmountSessionDrive = vi.fn(async () => undefined);

    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionDrives: SESSION_DRIVES,
      onMountSessionDrive,
      onUnmountSessionDrive,
    });

    const tool = createWebMcpTool(modelContext);

    const mounted = await tool.execute?.({
      tool: 'mount_session_drive',
      args: { sessionId: 'session-2' },
    }, {} as never);
    expect(mounted).toEqual({ sessionId: 'session-2', label: 'Session 2', mounted: true });
    expect(onMountSessionDrive).toHaveBeenCalledWith('session-2');

    const unmounted = await tool.execute?.({
      tool: 'unmount_session_drive',
      args: { sessionId: 'session-1' },
    }, {} as never);
    expect(unmounted).toEqual({ sessionId: 'session-1', label: 'Session 1', mounted: false });
    expect(onUnmountSessionDrive).toHaveBeenCalledWith('session-1');
  });

  it('throws TypeError when mounting with an empty sessionId', async () => {
    const modelContext = new ModelContext();
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      onMountSessionDrive: vi.fn(async () => undefined),
    });

    const tool = createWebMcpTool(modelContext);
    await expect(
      tool.execute?.({ tool: 'mount_session_drive', args: { sessionId: '  ' } }, {} as never),
    ).rejects.toThrow('sessionId');
  });

  it('throws TypeError when unmounting with an empty sessionId', async () => {
    const modelContext = new ModelContext();
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      onUnmountSessionDrive: vi.fn(async () => undefined),
    });

    const tool = createWebMcpTool(modelContext);
    await expect(
      tool.execute?.({ tool: 'unmount_session_drive', args: { sessionId: '' } }, {} as never),
    ).rejects.toThrow('sessionId');
  });

  it('lists session filesystem entries sorted by sessionId then path', async () => {
    const modelContext = new ModelContext();
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
    });

    const tool = createWebMcpTool(modelContext);
    const entries = await tool.execute?.({ tool: 'list_session_filesystem' }, {} as never) as Array<{ path: string }>;
    // Verify sorted order
    expect(entries[0]).toMatchObject({ sessionId: 'session-1', path: '/' });
  });

  it('reads a session folder and returns direct children', async () => {
    const modelContext = new ModelContext();
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
    });

    const tool = createWebMcpTool(modelContext);
    const result = await tool.execute?.({
      tool: 'read_session_folder',
      args: { sessionId: 'session-1', path: '/' },
    }, {} as never) as { entries: Array<{ path: string }> };

    expect(result.entries.map((c) => c.path)).toContain('/notes');
    expect(result.entries.map((c) => c.path)).toContain('/readme.md');
  });

  it('reads a session file with inline content', async () => {
    const modelContext = new ModelContext();
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
    });

    const tool = createWebMcpTool(modelContext);
    const result = await tool.execute?.({
      tool: 'read_session_file',
      args: { sessionId: 'session-1', path: '/readme.md' },
    }, {} as never);

    expect(result).toMatchObject({ sessionId: 'session-1', path: '/readme.md', content: '# Readme' });
  });

  it('reads a session file via onReadSessionFsFile callback when content is absent', async () => {
    const entriesNoContent = SESSION_FS_ENTRIES.map((e) =>
      e.kind === 'file' ? { ...e, content: undefined } : e,
    );
    const modelContext = new ModelContext();
    const onReadSessionFsFile = vi.fn(async (input: { sessionId: string; path: string }) => ({
      sessionId: input.sessionId,
      path: input.path,
      content: 'fetched content',
    }));

    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: entriesNoContent,
      onReadSessionFsFile,
    });

    const tool = createWebMcpTool(modelContext);
    const result = await tool.execute?.({
      tool: 'read_session_file',
      args: { sessionId: 'session-1', path: '/readme.md' },
    }, {} as never);

    expect(result).toMatchObject({ content: 'fetched content' });
    expect(onReadSessionFsFile).toHaveBeenCalledWith({ sessionId: 'session-1', path: '/readme.md' });
  });

  it('falls back to empty content when onReadSessionFsFile returns non-object', async () => {
    const entriesNoContent = SESSION_FS_ENTRIES.map((e) =>
      e.kind === 'file' ? { ...e, content: undefined } : e,
    );
    const modelContext = new ModelContext();
    const onReadSessionFsFile = vi.fn(async () => undefined);

    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: entriesNoContent,
      onReadSessionFsFile,
    });

    const tool = createWebMcpTool(modelContext);
    const result = await tool.execute?.({
      tool: 'read_session_file',
      args: { sessionId: 'session-1', path: '/readme.md' },
    }, {} as never);

    expect(result).toMatchObject({ sessionId: 'session-1', path: '/readme.md', content: '' });
  });

  it('throws TypeError when reading a file path that is a folder', async () => {
    const modelContext = new ModelContext();
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      onReadSessionFsFile: vi.fn(async () => undefined),
    });

    const tool = createWebMcpTool(modelContext);
    await expect(
      tool.execute?.({ tool: 'read_session_file', args: { sessionId: 'session-1', path: '/notes' } }, {} as never),
    ).rejects.toThrow('not a file');
  });

  it('throws TypeError when reading a folder path that is a file', async () => {
    const modelContext = new ModelContext();
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
    });

    const tool = createWebMcpTool(modelContext);
    await expect(
      tool.execute?.({ tool: 'read_session_folder', args: { sessionId: 'session-1', path: '/readme.md' } }, {} as never),
    ).rejects.toThrow('not a folder');
  });

  it('creates a session file and folder', async () => {
    const modelContext = new ModelContext();
    const onCreateSessionFsEntry = vi.fn(async () => undefined);

    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      onCreateSessionFsEntry,
    });

    const tool = createWebMcpTool(modelContext);

    const fileResult = await tool.execute?.({
      tool: 'create_session_file',
      args: { sessionId: 'session-1', path: '/new.txt', content: 'new content' },
    }, {} as never);
    expect(fileResult).toMatchObject({ sessionId: 'session-1', path: '/new.txt', kind: 'file' });
    expect(onCreateSessionFsEntry).toHaveBeenCalledWith({ sessionId: 'session-1', path: '/new.txt', kind: 'file', content: 'new content' });

    const folderResult = await tool.execute?.({
      tool: 'create_session_folder',
      args: { sessionId: 'session-1', path: '/newdir' },
    }, {} as never);
    expect(folderResult).toMatchObject({ sessionId: 'session-1', path: '/newdir', kind: 'folder' });
    expect(onCreateSessionFsEntry).toHaveBeenCalledWith({ sessionId: 'session-1', path: '/newdir', kind: 'folder' });
  });

  it('creates a file with empty content when content is absent', async () => {
    const modelContext = new ModelContext();
    const onCreateSessionFsEntry = vi.fn(async () => undefined);

    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      onCreateSessionFsEntry,
    });

    const tool = createWebMcpTool(modelContext);
    await tool.execute?.({
      tool: 'create_session_file',
      args: { sessionId: 'session-1', path: '/empty.txt' },
    }, {} as never);
    expect(onCreateSessionFsEntry).toHaveBeenCalledWith({ sessionId: 'session-1', path: '/empty.txt', kind: 'file', content: '' });
  });

  it('accepts visible session drive locations without requiring sessionId', async () => {
    const modelContext = new ModelContext();
    const onCreateSessionFsEntry = vi.fn(async () => undefined);

    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionDrives: VISIBLE_SESSION_DRIVES,
      sessionFsEntries: SESSION_FS_ENTRIES,
      onCreateSessionFsEntry,
    });

    const tool = createWebMcpTool(modelContext);
    const result = await tool.execute?.({
      tool: 'create_session_file',
      args: { path: '//session-1-fs/workspace/linked.md', content: 'linked' },
    }, {} as never);

    expect(result).toMatchObject({ sessionId: 'session-1', path: '/workspace/linked.md', kind: 'file', content: 'linked' });
    expect(onCreateSessionFsEntry).toHaveBeenCalledWith({ sessionId: 'session-1', path: '/workspace/linked.md', kind: 'file', content: 'linked' });
  });

  it('writes a session file', async () => {
    const modelContext = new ModelContext();
    const onWriteSessionFsFile = vi.fn(async () => undefined);

    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      onWriteSessionFsFile,
    });

    const tool = createWebMcpTool(modelContext);
    const result = await tool.execute?.({
      tool: 'write_session_file',
      args: { sessionId: 'session-1', path: '/readme.md', content: 'Updated!' },
    }, {} as never);

    expect(result).toMatchObject({ sessionId: 'session-1', path: '/readme.md', kind: 'file', content: 'Updated!' });
    expect(onWriteSessionFsFile).toHaveBeenCalledWith({ sessionId: 'session-1', path: '/readme.md', content: 'Updated!' });
  });

  it('deletes a session filesystem entry', async () => {
    const modelContext = new ModelContext();
    const onDeleteSessionFsEntry = vi.fn(async () => undefined);

    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      onDeleteSessionFsEntry,
    });

    const tool = createWebMcpTool(modelContext);
    const result = await tool.execute?.({
      tool: 'delete_session_filesystem_entry',
      args: { sessionId: 'session-1', path: '/readme.md' },
    }, {} as never);

    expect(result).toMatchObject({ sessionId: 'session-1', path: '/readme.md', deleted: true });
    expect(onDeleteSessionFsEntry).toHaveBeenCalledWith({ sessionId: 'session-1', path: '/readme.md' });
  });

  it('renames a session filesystem entry using newPath', async () => {
    const modelContext = new ModelContext();
    const onRenameSessionFsEntry = vi.fn(async () => undefined);

    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      onRenameSessionFsEntry,
    });

    const tool = createWebMcpTool(modelContext);
    const result = await tool.execute?.({
      tool: 'rename_session_filesystem_entry',
      args: { sessionId: 'session-1', path: '/readme.md', newPath: '/README.md' },
    }, {} as never);

    expect(result).toMatchObject({ sessionId: 'session-1', path: '/README.md', previousPath: '/readme.md' });
    expect(onRenameSessionFsEntry).toHaveBeenCalledWith({ sessionId: 'session-1', path: '/readme.md', newPath: '/README.md' });
  });

  it('renames a session filesystem entry using visible session drive paths', async () => {
    const modelContext = new ModelContext();
    const onRenameSessionFsEntry = vi.fn(async () => undefined);

    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionDrives: VISIBLE_SESSION_DRIVES,
      sessionFsEntries: SESSION_FS_ENTRIES,
      onRenameSessionFsEntry,
    });

    const tool = createWebMcpTool(modelContext);
    const result = await tool.execute?.({
      tool: 'rename_session_filesystem_entry',
      args: {
        path: '//session-1-fs/readme.md',
        newPath: '//session-1-fs/README.md',
      },
    }, {} as never);

    expect(result).toMatchObject({ sessionId: 'session-1', path: '/README.md', previousPath: '/readme.md' });
    expect(onRenameSessionFsEntry).toHaveBeenCalledWith({ sessionId: 'session-1', path: '/readme.md', newPath: '/README.md' });
  });

  it('rejects visible rename targets that switch sessions', async () => {
    const modelContext = new ModelContext();
    const onRenameSessionFsEntry = vi.fn(async () => undefined);

    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionDrives: MULTI_VISIBLE_SESSION_DRIVES,
      sessionFsEntries: SESSION_FS_ENTRIES,
      onRenameSessionFsEntry,
    });

    const tool = createWebMcpTool(modelContext);
    await expect(tool.execute?.({
      tool: 'rename_session_filesystem_entry',
      args: {
        path: '//session-1-fs/readme.md',
        newPath: '//session-2-fs/README.md',
      },
    }, {} as never)).rejects.toThrow('must stay within the same session');
    expect(onRenameSessionFsEntry).not.toHaveBeenCalled();
  });

  it('renames a session filesystem entry using newName', async () => {
    const modelContext = new ModelContext();
    const onRenameSessionFsEntry = vi.fn(async () => undefined);

    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      onRenameSessionFsEntry,
    });

    const tool = createWebMcpTool(modelContext);
    const result = await tool.execute?.({
      tool: 'rename_session_filesystem_entry',
      args: { sessionId: 'session-1', path: '/notes/hello.txt', newName: 'world.txt' },
    }, {} as never);

    expect(result).toMatchObject({ sessionId: 'session-1', path: '/notes/world.txt', previousPath: '/notes/hello.txt' });
  });

  it('throws TypeError when renaming without newPath or newName', async () => {
    const modelContext = new ModelContext();
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      onRenameSessionFsEntry: vi.fn(async () => undefined),
    });

    const tool = createWebMcpTool(modelContext);
    await expect(
      tool.execute?.({
        tool: 'rename_session_filesystem_entry',
        args: { sessionId: 'session-1', path: '/readme.md', newName: '   ' },
      }, {} as never),
    ).rejects.toThrow('newPath or newName');
  });

  it('scaffolds a template into a mounted session filesystem', async () => {
    const modelContext = new ModelContext();
    const onScaffoldSessionFsEntry = vi.fn(async () => undefined);

    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      onScaffoldSessionFsEntry,
    });

    const tool = createWebMcpTool(modelContext);
    const result = await tool.execute?.({
      tool: 'scaffold_session_filesystem_entry',
      args: { sessionId: 'session-1', basePath: '/workspace', template: 'hook' },
    }, {} as never);

    expect(result).toMatchObject({ sessionId: 'session-1', path: '/workspace/hook', template: 'hook' });
    expect(onScaffoldSessionFsEntry).toHaveBeenCalledWith({ sessionId: 'session-1', basePath: '/workspace', template: 'hook' });
  });

  it('throws TypeError when scaffolding without a template', async () => {
    const modelContext = new ModelContext();
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      onScaffoldSessionFsEntry: vi.fn(async () => undefined),
    });

    const tool = createWebMcpTool(modelContext);
    await expect(
      tool.execute?.({
        tool: 'scaffold_session_filesystem_entry',
        args: { sessionId: 'session-1', basePath: '/', template: '' },
      }, {} as never),
    ).rejects.toThrow('template');
  });

  it('returns plain-object results from callbacks verbatim', async () => {
    const modelContext = new ModelContext();
    const customResult = { sessionId: 'session-1', path: '/custom.txt', kind: 'file', content: 'custom', extra: true };
    const onCreateSessionFsEntry = vi.fn(async () => customResult);

    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      onCreateSessionFsEntry,
    });

    const tool = createWebMcpTool(modelContext);
    const result = await tool.execute?.({
      tool: 'create_session_file',
      args: { sessionId: 'session-1', path: '/custom.txt', content: 'custom' },
    }, {} as never);

    expect(result).toEqual(customResult);
  });

  it('returns structured result from mount/unmount when callback returns a valid drive object', async () => {
    const modelContext = new ModelContext();
    const structuredResult = { sessionId: 'session-2', label: 'Custom Label', mounted: true };
    const onMountSessionDrive = vi.fn(async () => structuredResult);

    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionDrives: SESSION_DRIVES,
      onMountSessionDrive,
    });

    const tool = createWebMcpTool(modelContext);
    const result = await tool.execute?.({
      tool: 'mount_session_drive',
      args: { sessionId: 'session-2' },
    }, {} as never);

    expect(result).toEqual(structuredResult);
  });

  it('throws NotFoundError when reading a session folder entry that does not exist', async () => {
    const modelContext = new ModelContext();
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
    });

    const tool = createWebMcpTool(modelContext);
    await expect(
      tool.execute?.({ tool: 'read_session_folder', args: { sessionId: 'session-1', path: '/nonexistent' } }, {} as never),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('respects AbortSignal to deregister tools', () => {
    const modelContext = new ModelContext();
    const controller = new AbortController();
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      signal: controller.signal,
    });

    expect(getModelContextRegistry(modelContext).list()).not.toHaveLength(0);
    controller.abort();
    expect(getModelContextRegistry(modelContext).list()).toHaveLength(0);
  });

  it('renames a root-level entry using newName (covers parent === "/" branch)', async () => {
    const modelContext = new ModelContext();
    const onRenameSessionFsEntry = vi.fn(async () => undefined);
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      onRenameSessionFsEntry,
    });
    const tool = createWebMcpTool(modelContext);
    // /readme.md → parentPath returns '/' → parent === '/' → newPath = '/README.md'
    const result = await tool.execute?.({
      tool: 'rename_session_filesystem_entry',
      args: { sessionId: 'session-1', path: '/readme.md', newName: 'README.md' },
    }, {} as never);
    expect(result).toMatchObject({ sessionId: 'session-1', path: '/README.md' });
  });

  it('renames the root folder using newName (covers parentPath null ?? "/" branch)', async () => {
    const modelContext = new ModelContext();
    const onRenameSessionFsEntry = vi.fn(async () => undefined);
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      onRenameSessionFsEntry,
    });
    const tool = createWebMcpTool(modelContext);
    // path='/' → parentPath('/') returns null → null ?? '/' = '/' → newPath = '/root-renamed'
    const result = await tool.execute?.({
      tool: 'rename_session_filesystem_entry',
      args: { sessionId: 'session-1', path: '/', newName: 'root-renamed' },
    }, {} as never);
    expect(result).toMatchObject({ sessionId: 'session-1', path: '/root-renamed' });
  });

  it('covers ?? fallback in scaffold when sessionId and basePath are absent (throws for empty path)', async () => {
    const modelContext = new ModelContext();
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      onScaffoldSessionFsEntry: vi.fn(async () => undefined),
    });
    const tool = createWebMcpTool(modelContext);
    // Missing sessionId and basePath trigger `?? ''` branches; empty basePath throws from normalizeSessionFsPath
    await expect(
      tool.execute?.({ tool: 'scaffold_session_filesystem_entry', args: {} }, {} as never),
    ).rejects.toThrow();
  });

  it('covers ?? fallback in rename when sessionId/path are absent (throws for empty path)', async () => {
    const modelContext = new ModelContext();
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      onRenameSessionFsEntry: vi.fn(async () => undefined),
    });
    const tool = createWebMcpTool(modelContext);
    // Missing sessionId/path triggers `?? ''` branches; empty path throws from normalizeSessionFsPath
    await expect(
      tool.execute?.({ tool: 'rename_session_filesystem_entry', args: {} }, {} as never),
    ).rejects.toThrow();
  });

  it('covers ?? fallback in write_session_file when sessionId/path/content are absent (throws for empty path)', async () => {
    const modelContext = new ModelContext();
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      onWriteSessionFsFile: vi.fn(async () => undefined),
    });
    const tool = createWebMcpTool(modelContext);
    await expect(
      tool.execute?.({ tool: 'write_session_file', args: {} }, {} as never),
    ).rejects.toThrow();
  });

  it('covers ?? fallback in delete_session_filesystem_entry when sessionId/path are absent (throws for empty path)', async () => {
    const modelContext = new ModelContext();
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      onDeleteSessionFsEntry: vi.fn(async () => undefined),
    });
    const tool = createWebMcpTool(modelContext);
    await expect(
      tool.execute?.({ tool: 'delete_session_filesystem_entry', args: {} }, {} as never),
    ).rejects.toThrow();
  });

  it('covers newName ?? fallback when renamed entry has no newName provided', async () => {
    const modelContext = new ModelContext();
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      onRenameSessionFsEntry: vi.fn(async () => undefined),
    });
    const tool = createWebMcpTool(modelContext);
    // Provide valid sessionId/path but omit both newPath and newName → triggers newName ?? '' fallback → throws
    await expect(
      tool.execute?.({ tool: 'rename_session_filesystem_entry', args: { sessionId: 'session-1', path: '/readme.md' } }, {} as never),
    ).rejects.toThrow('newPath or newName');
  });

  it('covers path ?? fallback in create_session_file when path is absent (throws for empty path)', async () => {
    const modelContext = new ModelContext();
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      onCreateSessionFsEntry: vi.fn(async () => undefined),
    });
    const tool = createWebMcpTool(modelContext);
    await expect(
      tool.execute?.({ tool: 'create_session_file', args: { sessionId: 'session-1' } }, {} as never),
    ).rejects.toThrow();
  });

  it('covers ?? fallbacks in create_session_folder when sessionId/path are absent (throws for empty path)', async () => {
    const modelContext = new ModelContext();
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      onCreateSessionFsEntry: vi.fn(async () => undefined),
    });
    const tool = createWebMcpTool(modelContext);
    await expect(
      tool.execute?.({ tool: 'create_session_folder', args: {} }, {} as never),
    ).rejects.toThrow();
  });

  it('covers content ?? fallback in write_session_file when content is absent (writes empty string)', async () => {
    const modelContext = new ModelContext();
    const onWriteSessionFsFile = vi.fn(async () => undefined);
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      onWriteSessionFsFile,
    });
    const tool = createWebMcpTool(modelContext);
    const result = await tool.execute?.({
      tool: 'write_session_file',
      args: { sessionId: 'session-1', path: '/readme.md' },
    }, {} as never);
    expect(result).toMatchObject({ content: '' });
    expect(onWriteSessionFsFile).toHaveBeenCalledWith({ sessionId: 'session-1', path: '/readme.md', content: '' });
  });

  it('covers sessionId ?? fallback in create_session_file when sessionId is absent (throws for empty sessionId/path)', async () => {
    const modelContext = new ModelContext();
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: SESSION_FS_ENTRIES,
      onCreateSessionFsEntry: vi.fn(async () => undefined),
    });
    const tool = createWebMcpTool(modelContext);
    await expect(
      tool.execute?.({ tool: 'create_session_file', args: {} }, {} as never),
    ).rejects.toThrow();
  });

  it('covers sessionId ?? fallback in mount_session_drive when sessionId is absent (throws TypeError)', async () => {
    const modelContext = new ModelContext();
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionDrives: SESSION_DRIVES,
      onMountSessionDrive: vi.fn(async () => undefined),
    });
    const tool = createWebMcpTool(modelContext);
    await expect(
      tool.execute?.({ tool: 'mount_session_drive', args: {} }, {} as never),
    ).rejects.toThrow(TypeError);
  });

  it('covers sessionId ?? fallback in unmount_session_drive when sessionId is absent (throws TypeError)', async () => {
    const modelContext = new ModelContext();
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionDrives: SESSION_DRIVES,
      onUnmountSessionDrive: vi.fn(async () => undefined),
    });
    const tool = createWebMcpTool(modelContext);
    await expect(
      tool.execute?.({ tool: 'unmount_session_drive', args: {} }, {} as never),
    ).rejects.toThrow(TypeError);
  });

  it('covers drive?.label ?? sessionId fallback when mounted sessionId is not in sessionDrives', async () => {
    const modelContext = new ModelContext();
    const onMountSessionDrive = vi.fn(async () => undefined);
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionDrives: SESSION_DRIVES,
      onMountSessionDrive,
    });
    const tool = createWebMcpTool(modelContext);
    // 'session-99' is not in SESSION_DRIVES, so drive?.label is undefined → falls back to sessionId
    const result = await tool.execute?.({
      tool: 'mount_session_drive',
      args: { sessionId: 'session-99' },
    }, {} as never);
    expect(result).toMatchObject({ sessionId: 'session-99', label: 'session-99', mounted: true });
  });

  it('falls back to normalizeSessionFsMutationResult when onReadSessionFsFile returns incomplete object (covers line 198 branch)', async () => {
    const entriesNoContent = SESSION_FS_ENTRIES.map((e) =>
      e.kind === 'file' ? { ...e, content: undefined } : e,
    );
    const modelContext = new ModelContext();
    // Returning an object that passes isPlainObject but fails the string property checks
    const onReadSessionFsFile = vi.fn(async () => ({ sessionId: 'session-1' }));
    registerSessionFilesystemTools(modelContext, {
      workspaceName: 'Research',
      sessionFsEntries: entriesNoContent,
      onReadSessionFsFile,
    });
    const tool = createWebMcpTool(modelContext);
    const result = await tool.execute?.({
      tool: 'read_session_file',
      args: { sessionId: 'session-1', path: '/readme.md' },
    }, {} as never);
    // normalizeSessionFsMutationResult returns plain-object results verbatim
    expect(result).toEqual({ sessionId: 'session-1' });
  });
});
