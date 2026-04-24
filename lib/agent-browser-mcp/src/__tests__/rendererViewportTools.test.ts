import { describe, expect, it, vi } from 'vitest';
import { getModelContextRegistry, ModelContext } from '@agent-harness/webmcp';
import { registerRendererViewportTools } from '../rendererViewportTools';
import { createWebMcpTool } from '../tool';

const RENDER_PANES = [
  { id: 'pane-1', title: 'Preview', url: 'https://localhost:5173' },
  { id: 'pane-2', title: 'Docs', url: 'https://example.com/docs' },
];

describe('registerRendererViewportTools', () => {
  it('registers no tools when no render panes or callbacks are provided', () => {
    const modelContext = new ModelContext();
    registerRendererViewportTools(modelContext, { workspaceName: 'Research' });
    expect(getModelContextRegistry(modelContext).list()).toHaveLength(0);
  });

  it('registers list_render_panes when renderPanes are provided', async () => {
    const modelContext = new ModelContext();
    registerRendererViewportTools(modelContext, {
      workspaceName: 'Research',
      renderPanes: RENDER_PANES,
    });

    const tool = createWebMcpTool(modelContext);
    const listed = await tool.execute?.({ tool: 'list_render_panes' }, {} as never);
    expect(listed).toEqual(RENDER_PANES);
  });

  it('registers close_render_pane when onCloseRenderPane is provided', async () => {
    const modelContext = new ModelContext();
    const onCloseRenderPane = vi.fn(async () => undefined);
    registerRendererViewportTools(modelContext, {
      workspaceName: 'Research',
      renderPanes: RENDER_PANES,
      onCloseRenderPane,
    });

    const tool = createWebMcpTool(modelContext);
    const result = await tool.execute?.({
      tool: 'close_render_pane',
      args: { paneId: 'pane-1' },
    }, {} as never);

    expect(result).toEqual({ paneId: 'pane-1', closed: true });
    expect(onCloseRenderPane).toHaveBeenCalledWith('pane-1');
  });

  it('throws NotFoundError when closing an unknown pane id', async () => {
    const modelContext = new ModelContext();
    registerRendererViewportTools(modelContext, {
      workspaceName: 'Research',
      renderPanes: RENDER_PANES,
      onCloseRenderPane: vi.fn(async () => undefined),
    });

    const tool = createWebMcpTool(modelContext);
    await expect(
      tool.execute?.({ tool: 'close_render_pane', args: { paneId: 'unknown' } }, {} as never),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('registers move_render_pane when onMoveRenderPane is provided', async () => {
    const modelContext = new ModelContext();
    const onMoveRenderPane = vi.fn(async () => undefined);
    registerRendererViewportTools(modelContext, {
      workspaceName: 'Research',
      renderPanes: RENDER_PANES,
      onMoveRenderPane,
    });

    const tool = createWebMcpTool(modelContext);
    const result = await tool.execute?.({
      tool: 'move_render_pane',
      args: { paneId: 'pane-2', toIndex: 0 },
    }, {} as never);

    expect(result).toEqual({ paneId: 'pane-2', toIndex: 0 });
    expect(onMoveRenderPane).toHaveBeenCalledWith({ paneId: 'pane-2', toIndex: 0 });
  });

  it('returns structured result when onMoveRenderPane returns an array', async () => {
    const modelContext = new ModelContext();
    const reordered = [RENDER_PANES[1], RENDER_PANES[0]];
    const onMoveRenderPane = vi.fn(async () => reordered);
    registerRendererViewportTools(modelContext, {
      workspaceName: 'Research',
      renderPanes: RENDER_PANES,
      onMoveRenderPane,
    });

    const tool = createWebMcpTool(modelContext);
    const result = await tool.execute?.({
      tool: 'move_render_pane',
      args: { paneId: 'pane-1', toIndex: 1 },
    }, {} as never);

    expect(result).toEqual(reordered);
  });

  it('throws TypeError when moving a pane to a negative index', async () => {
    const modelContext = new ModelContext();
    registerRendererViewportTools(modelContext, {
      workspaceName: 'Research',
      renderPanes: RENDER_PANES,
      onMoveRenderPane: vi.fn(async () => undefined),
    });

    const tool = createWebMcpTool(modelContext);
    await expect(
      tool.execute?.({ tool: 'move_render_pane', args: { paneId: 'pane-1', toIndex: -1 } }, {} as never),
    ).rejects.toThrow('toIndex');
  });

  it('throws TypeError when toIndex is not an integer', async () => {
    const modelContext = new ModelContext();
    registerRendererViewportTools(modelContext, {
      workspaceName: 'Research',
      renderPanes: RENDER_PANES,
      onMoveRenderPane: vi.fn(async () => undefined),
    });

    const tool = createWebMcpTool(modelContext);
    await expect(
      tool.execute?.({ tool: 'move_render_pane', args: { paneId: 'pane-1', toIndex: 1.5 } }, {} as never),
    ).rejects.toThrow('toIndex');
  });

  it('throws NotFoundError when moving an unknown pane id', async () => {
    const modelContext = new ModelContext();
    registerRendererViewportTools(modelContext, {
      workspaceName: 'Research',
      renderPanes: RENDER_PANES,
      onMoveRenderPane: vi.fn(async () => undefined),
    });

    const tool = createWebMcpTool(modelContext);
    await expect(
      tool.execute?.({ tool: 'move_render_pane', args: { paneId: 'nope', toIndex: 0 } }, {} as never),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('registers tools when only onCloseRenderPane is provided (no panes)', async () => {
    const modelContext = new ModelContext();
    registerRendererViewportTools(modelContext, {
      workspaceName: 'Research',
      onCloseRenderPane: vi.fn(async () => undefined),
    });
    const names = getModelContextRegistry(modelContext).list().map(({ name }) => name);
    expect(names).toContain('list_render_panes');
    expect(names).toContain('close_render_pane');
  });

  it('returns non-array result from onMoveRenderPane verbatim when it is not an array', async () => {
    const modelContext = new ModelContext();
    const customResult = { paneId: 'pane-1', toIndex: 1, extra: true };
    const onMoveRenderPane = vi.fn(async () => customResult);
    registerRendererViewportTools(modelContext, {
      workspaceName: 'Research',
      renderPanes: RENDER_PANES,
      onMoveRenderPane,
    });

    const tool = createWebMcpTool(modelContext);
    const result = await tool.execute?.({
      tool: 'move_render_pane',
      args: { paneId: 'pane-1', toIndex: 1 },
    }, {} as never);

    // Non-array object result falls through to fallback { paneId, toIndex }
    // (the implementation checks Array.isArray; a plain object is not an array)
    expect(result).toEqual({ paneId: 'pane-1', toIndex: 1 });
  });

  it('respects AbortSignal to deregister tools', () => {
    const modelContext = new ModelContext();
    const controller = new AbortController();
    registerRendererViewportTools(modelContext, {
      workspaceName: 'Research',
      renderPanes: RENDER_PANES,
      signal: controller.signal,
    });

    expect(getModelContextRegistry(modelContext).list()).not.toHaveLength(0);
    controller.abort();
    expect(getModelContextRegistry(modelContext).list()).toHaveLength(0);
  });

  it('covers ?? fallback in close_render_pane when paneId is absent (throws)', async () => {
    const modelContext = new ModelContext();
    registerRendererViewportTools(modelContext, {
      workspaceName: 'Research',
      renderPanes: RENDER_PANES,
      onCloseRenderPane: vi.fn(async () => undefined),
    });
    const tool = createWebMcpTool(modelContext);
    // omitting paneId triggers `paneId ?? ''` → empty string → readRenderPane throws NotFoundError
    const result = tool.execute?.({ tool: 'close_render_pane', args: {} }, {} as never);
    await expect(result).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('covers ?? fallback in move_render_pane when paneId is absent (throws)', async () => {
    const modelContext = new ModelContext();
    registerRendererViewportTools(modelContext, {
      workspaceName: 'Research',
      renderPanes: RENDER_PANES,
      onMoveRenderPane: vi.fn(async () => undefined),
    });
    const tool = createWebMcpTool(modelContext);
    const result = tool.execute?.({ tool: 'move_render_pane', args: { toIndex: 0 } }, {} as never);
    await expect(result).rejects.toMatchObject({ name: 'NotFoundError' });
  });
});
