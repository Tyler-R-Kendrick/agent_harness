import { describe, expect, it, vi } from 'vitest';
import { getModelContextRegistry, ModelContext } from '@agent-harness/webmcp';
import { registerClipboardTools } from '../clipboardTools';
import { createWebMcpTool } from '../tool';

const CLIPBOARD_ENTRIES = [
  { id: 'entry-1', text: 'Hello world', createdAt: '2026-04-20T00:00:00Z' },
  { id: 'entry-2', text: 'npm install', createdAt: '2026-04-20T00:01:00Z' },
];

describe('registerClipboardTools', () => {
  it('registers no tools when no clipboard data or callbacks are provided', () => {
    const modelContext = new ModelContext();
    registerClipboardTools(modelContext, { workspaceName: 'Research' });
    expect(getModelContextRegistry(modelContext).list()).toHaveLength(0);
  });

  it('registers list and read tools when clipboardEntries are provided', async () => {
    const modelContext = new ModelContext();
    registerClipboardTools(modelContext, {
      workspaceName: 'Research',
      clipboardEntries: CLIPBOARD_ENTRIES,
    });

    const tool = createWebMcpTool(modelContext);

    const listed = await tool.execute?.({ tool: 'list_clipboard_history' }, {} as never);
    expect(listed).toEqual(CLIPBOARD_ENTRIES);

    const entry = await tool.execute?.({ tool: 'read_clipboard_entry', args: { entryId: 'entry-1' } }, {} as never);
    expect(entry).toEqual(CLIPBOARD_ENTRIES[0]);
  });

  it('throws NotFoundError when reading an unknown entry id', async () => {
    const modelContext = new ModelContext();
    registerClipboardTools(modelContext, {
      workspaceName: 'Research',
      clipboardEntries: CLIPBOARD_ENTRIES,
    });

    const tool = createWebMcpTool(modelContext);
    await expect(
      tool.execute?.({ tool: 'read_clipboard_entry', args: { entryId: 'missing' } }, {} as never),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('registers restore tool when onRestoreClipboardEntry is provided', async () => {
    const modelContext = new ModelContext();
    const onRestoreClipboardEntry = vi.fn(async (id: string) => ({
      id,
      text: 'Restored!',
      createdAt: '2026-04-20T00:02:00Z',
      isActive: true,
    }));

    registerClipboardTools(modelContext, {
      workspaceName: 'Research',
      clipboardEntries: CLIPBOARD_ENTRIES,
      onRestoreClipboardEntry,
    });

    const tool = createWebMcpTool(modelContext);

    const result = await tool.execute?.({
      tool: 'restore_clipboard_entry',
      args: { entryId: 'entry-2' },
    }, {} as never);

    expect(result).toEqual({ id: 'entry-2', text: 'Restored!', createdAt: '2026-04-20T00:02:00Z', isActive: true });
    expect(onRestoreClipboardEntry).toHaveBeenCalledWith('entry-2');
  });

  it('falls back to entry with isActive:true when restore callback returns non-object', async () => {
    const modelContext = new ModelContext();
    const onRestoreClipboardEntry = vi.fn(async () => undefined);

    registerClipboardTools(modelContext, {
      workspaceName: 'Research',
      clipboardEntries: CLIPBOARD_ENTRIES,
      onRestoreClipboardEntry,
    });

    const tool = createWebMcpTool(modelContext);

    const result = await tool.execute?.({
      tool: 'restore_clipboard_entry',
      args: { entryId: 'entry-1' },
    }, {} as never);

    expect(result).toEqual({ ...CLIPBOARD_ENTRIES[0], isActive: true });
  });

  it('throws NotFoundError when restoring an unknown clipboard entry', async () => {
    const modelContext = new ModelContext();
    registerClipboardTools(modelContext, {
      workspaceName: 'Research',
      clipboardEntries: CLIPBOARD_ENTRIES,
      onRestoreClipboardEntry: vi.fn(async () => undefined),
    });

    const tool = createWebMcpTool(modelContext);
    await expect(
      tool.execute?.({ tool: 'restore_clipboard_entry', args: { entryId: 'nope' } }, {} as never),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('registers tools when only onRestoreClipboardEntry is provided (no entries)', async () => {
    const modelContext = new ModelContext();
    const onRestoreClipboardEntry = vi.fn(async () => undefined);
    registerClipboardTools(modelContext, {
      workspaceName: 'Research',
      onRestoreClipboardEntry,
    });
    const names = getModelContextRegistry(modelContext).list().map(({ name }) => name);
    expect(names).toContain('list_clipboard_history');
    expect(names).toContain('read_clipboard_entry');
    expect(names).toContain('restore_clipboard_entry');
  });

  it('returns callback result directly when it has valid id and text', async () => {
    const modelContext = new ModelContext();
    const restored = { id: 'entry-1', text: 'Direct!', createdAt: '2026-04-20T00:03:00Z', isActive: true };
    const onRestoreClipboardEntry = vi.fn(async () => restored);

    registerClipboardTools(modelContext, {
      workspaceName: 'Research',
      clipboardEntries: CLIPBOARD_ENTRIES,
      onRestoreClipboardEntry,
    });

    const tool = createWebMcpTool(modelContext);
    const result = await tool.execute?.({
      tool: 'restore_clipboard_entry',
      args: { entryId: 'entry-1' },
    }, {} as never);

    expect(result).toEqual(restored);
  });

  it('respects AbortSignal to deregister tools', () => {
    const modelContext = new ModelContext();
    const controller = new AbortController();
    registerClipboardTools(modelContext, {
      workspaceName: 'Research',
      clipboardEntries: CLIPBOARD_ENTRIES,
      signal: controller.signal,
    });

    expect(getModelContextRegistry(modelContext).list()).not.toHaveLength(0);
    controller.abort();
    expect(getModelContextRegistry(modelContext).list()).toHaveLength(0);
  });

  it('covers ?? fallback in read_clipboard_entry when entryId is absent (throws)', async () => {
    const modelContext = new ModelContext();
    registerClipboardTools(modelContext, {
      workspaceName: 'Research',
      clipboardEntries: CLIPBOARD_ENTRIES,
    });
    const tool = createWebMcpTool(modelContext);
    // omitting entryId triggers `entryId ?? ''` → empty string → NotFoundError
    await expect(
      tool.execute?.({ tool: 'read_clipboard_entry', args: {} }, {} as never),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('covers ?? fallback in restore_clipboard_entry when entryId is absent (throws)', async () => {
    const modelContext = new ModelContext();
    registerClipboardTools(modelContext, {
      workspaceName: 'Research',
      clipboardEntries: CLIPBOARD_ENTRIES,
      onRestoreClipboardEntry: vi.fn(async () => undefined),
    });
    const tool = createWebMcpTool(modelContext);
    await expect(
      tool.execute?.({ tool: 'restore_clipboard_entry', args: {} }, {} as never),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });
});
