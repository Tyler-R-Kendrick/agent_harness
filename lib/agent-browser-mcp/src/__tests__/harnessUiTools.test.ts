import { describe, expect, it, vi } from 'vitest';
import { getModelContextRegistry, ModelContext } from '@agent-harness/webmcp';
import { createWebMcpTool } from '../tool';
import { registerHarnessUiTools } from '../harnessUiTools';

const HARNESS_ELEMENTS = [
  {
    id: 'app-shell',
    type: 'HarnessShell',
    title: 'Research',
    editable: true,
    slot: 'app',
    path: 'HarnessShell',
  },
  {
    id: 'workspace-sidebar',
    type: 'WorkspaceSidebar',
    title: 'Workspace tree',
    editable: true,
    slot: 'app.sidebar',
    path: 'HarnessShell/WorkspaceSidebar',
  },
] as const;

describe('registerHarnessUiTools', () => {
  it('registers no tools without harness state or callbacks', () => {
    const modelContext = new ModelContext();
    registerHarnessUiTools(modelContext, { workspaceName: 'Research' });
    expect(getModelContextRegistry(modelContext).list()).toHaveLength(0);
  });

  it('lists elements, reads an element, and returns compact prompt context rows', async () => {
    const modelContext = new ModelContext();
    registerHarnessUiTools(modelContext, {
      workspaceName: 'Research',
      harnessElements: HARNESS_ELEMENTS,
      getHarnessElement: (elementId) => ({ id: elementId, type: 'WorkspaceSidebar', props: { title: 'Workspace tree' } }),
      getHarnessPromptContext: () => ['workspace-sidebar|WorkspaceSidebar|Workspace tree|editable|app.sidebar'],
    });

    const tool = createWebMcpTool(modelContext);
    await expect(tool.execute?.({ tool: 'list_harness_elements' }, {} as never)).resolves.toEqual(HARNESS_ELEMENTS);
    await expect(tool.execute?.({
      tool: 'read_harness_element',
      args: { elementId: 'workspace-sidebar' },
    }, {} as never)).resolves.toEqual({
      id: 'workspace-sidebar',
      type: 'WorkspaceSidebar',
      props: { title: 'Workspace tree' },
    });
    await expect(tool.execute?.({ tool: 'read_harness_prompt_context' }, {} as never)).resolves.toEqual({
      rows: ['workspace-sidebar|WorkspaceSidebar|Workspace tree|editable|app.sidebar'],
    });
  });

  it('patches, regenerates, and restores the harness through callbacks', async () => {
    const modelContext = new ModelContext();
    const onPatchHarnessElement = vi.fn(async () => ({ elementId: 'workspace-sidebar', updated: true }));
    const onRegenerateHarness = vi.fn(async () => ({ summary: 'Updated sidebar' }));
    const onRestoreHarness = vi.fn(async () => ({ summary: 'Restored' }));
    registerHarnessUiTools(modelContext, {
      workspaceName: 'Research',
      harnessElements: HARNESS_ELEMENTS,
      onPatchHarnessElement,
      onRegenerateHarness,
      onRestoreHarness,
    });

    const tool = createWebMcpTool(modelContext);
    await expect(tool.execute?.({
      tool: 'patch_harness_element',
      args: { elementId: 'workspace-sidebar', props: { title: 'Project map' } },
    }, {} as never)).resolves.toEqual({ elementId: 'workspace-sidebar', updated: true });
    await expect(tool.execute?.({
      tool: 'regenerate_harness_ui',
      args: { prompt: 'Make sidebar compact' },
    }, {} as never)).resolves.toEqual({ summary: 'Updated sidebar' });
    await expect(tool.execute?.({ tool: 'restore_harness_ui' }, {} as never)).resolves.toEqual({ summary: 'Restored' });

    expect(onPatchHarnessElement).toHaveBeenCalledWith({
      elementId: 'workspace-sidebar',
      props: { title: 'Project map' },
    });
    expect(onRegenerateHarness).toHaveBeenCalledWith({ prompt: 'Make sidebar compact' });
    expect(onRestoreHarness).toHaveBeenCalledTimes(1);
  });

  it('throws clear errors for unknown elements and invalid write inputs', async () => {
    const modelContext = new ModelContext();
    registerHarnessUiTools(modelContext, {
      workspaceName: 'Research',
      harnessElements: HARNESS_ELEMENTS,
      onPatchHarnessElement: vi.fn(async () => undefined),
      onRegenerateHarness: vi.fn(async () => undefined),
    });

    const tool = createWebMcpTool(modelContext);
    await expect(tool.execute?.({
      tool: 'read_harness_element',
      args: { elementId: 'missing' },
    }, {} as never)).rejects.toMatchObject({ name: 'NotFoundError' });
    await expect(tool.execute?.({
      tool: 'read_harness_element',
      args: {},
    }, {} as never)).rejects.toThrow('elementId');
    await expect(tool.execute?.({
      tool: 'patch_harness_element',
      args: { elementId: 'workspace-sidebar', props: null },
    }, {} as never)).rejects.toThrow('props');
    await expect(tool.execute?.({
      tool: 'regenerate_harness_ui',
      args: { prompt: '   ' },
    }, {} as never)).rejects.toThrow('prompt');
  });

  it('uses safe fallbacks for optional context and patch callback results', async () => {
    const modelContext = new ModelContext();
    const onPatchHarnessElement = vi.fn(async () => undefined);
    registerHarnessUiTools(modelContext, {
      workspaceName: 'Research',
      harnessElements: HARNESS_ELEMENTS,
      onPatchHarnessElement,
    });

    const tool = createWebMcpTool(modelContext);
    await expect(tool.execute?.({ tool: 'read_harness_prompt_context' }, {} as never)).resolves.toEqual({ rows: [] });
    await expect(tool.execute?.({
      tool: 'patch_harness_element',
      args: { elementId: 'workspace-sidebar', props: { title: 'Project map' } },
    }, {} as never)).resolves.toEqual({ elementId: 'workspace-sidebar', updated: true });
  });

  it('respects AbortSignal to deregister tools', () => {
    const modelContext = new ModelContext();
    const controller = new AbortController();
    registerHarnessUiTools(modelContext, {
      workspaceName: 'Research',
      harnessElements: HARNESS_ELEMENTS,
      signal: controller.signal,
    });

    expect(getModelContextRegistry(modelContext).list()).not.toHaveLength(0);
    controller.abort();
    expect(getModelContextRegistry(modelContext).list()).toHaveLength(0);
  });
});
