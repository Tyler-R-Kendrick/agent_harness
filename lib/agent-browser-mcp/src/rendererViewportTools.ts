import { ModelContext } from '../../webmcp/src/index';

import type { RegisterWorkspaceToolsOptions, WorkspaceMcpRenderPane } from './workspaceToolTypes';

function readRenderPane(renderPanes: readonly WorkspaceMcpRenderPane[], paneId: string): WorkspaceMcpRenderPane {
  const pane = renderPanes.find((candidate) => candidate.id === paneId);
  if (!pane) {
    throw new DOMException(`Render pane "${paneId}" is not available.`, 'NotFoundError');
  }

  return pane;
}

export function registerRendererViewportTools(modelContext: ModelContext, options: RegisterWorkspaceToolsOptions): void {
  const {
    renderPanes = [],
    onCloseRenderPane,
    onMoveRenderPane,
    signal,
  } = options;

  const hasRendererTools = renderPanes.length > 0 || onCloseRenderPane || onMoveRenderPane;
  if (!hasRendererTools) {
    return;
  }

  modelContext.registerTool({
    name: 'list_render_panes',
    title: 'List render panes',
    description: 'List currently visible render panes in the active workspace.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    execute: async () => [...renderPanes],
    annotations: { readOnlyHint: true },
  }, { signal });

  if (onCloseRenderPane) {
    modelContext.registerTool({
      name: 'close_render_pane',
      title: 'Close render pane',
      description: 'Close a visible render pane in the active workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          paneId: { type: 'string' },
        },
        required: ['paneId'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const paneId = String((input as { paneId?: string }).paneId ?? '').trim();
        const pane = readRenderPane(renderPanes, paneId);
        await onCloseRenderPane(pane.id);
        return { paneId: pane.id, closed: true };
      },
    }, { signal });
  }

  if (onMoveRenderPane) {
    modelContext.registerTool({
      name: 'move_render_pane',
      title: 'Move render pane',
      description: 'Move a render pane to a new index in the active workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          paneId: { type: 'string' },
          toIndex: { type: 'integer', minimum: 0 },
        },
        required: ['paneId', 'toIndex'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as { paneId?: string; toIndex?: number };
        const paneId = String(typedInput.paneId ?? '').trim();
        const pane = readRenderPane(renderPanes, paneId);
        const toIndex = Number.isInteger(typedInput.toIndex) ? Number(typedInput.toIndex) : NaN;
        if (!Number.isInteger(toIndex) || toIndex < 0) {
          throw new TypeError('Render pane movement requires a non-negative integer toIndex.');
        }
        const result = await onMoveRenderPane({ paneId: pane.id, toIndex });
        return Array.isArray(result) ? result : { paneId: pane.id, toIndex };
      },
    }, { signal });
  }
}