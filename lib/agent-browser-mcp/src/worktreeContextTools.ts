import { ModelContext } from '@agent-harness/webmcp';

import type {
  RegisterWorkspaceToolsOptions,
  WorkspaceMcpWorktreeContextMenuState,
  WorkspaceMcpWorktreeItem,
  WorkspaceMcpWorktreeRenderPaneState,
} from './workspaceToolTypes';
import type { WorktreeActionInput, WorktreeItemInput } from './workspaceToolShared';
import {
  isPlainObject,
  normalizeWorktreeItems,
  readWorktreeItem,
} from './workspaceToolShared';

function toWorktreeRenderPaneState(
  item: WorkspaceMcpWorktreeItem,
  value: unknown,
): WorkspaceMcpWorktreeRenderPaneState {
  if (isPlainObject(value) && typeof value.isOpen === 'boolean') {
    return {
      itemId: item.id,
      itemType: item.itemType,
      isOpen: value.isOpen,
      supported: typeof value.supported === 'boolean' ? value.supported : true,
    };
  }

  return {
    itemId: item.id,
    itemType: item.itemType,
    isOpen: false,
    supported: true,
  };
}

function toWorktreeContextMenuState(
  item: WorkspaceMcpWorktreeItem,
  value: unknown,
): WorkspaceMcpWorktreeContextMenuState {
  if (isPlainObject(value) && typeof value.isOpen === 'boolean') {
    return {
      itemId: item.id,
      itemType: item.itemType,
      isOpen: value.isOpen,
      supported: typeof value.supported === 'boolean' ? value.supported : true,
    };
  }

  return {
    itemId: item.id,
    itemType: item.itemType,
    isOpen: false,
    supported: true,
  };
}

export function registerWorktreeContextTools(modelContext: ModelContext, options: RegisterWorkspaceToolsOptions): void {
  const {
    worktreeItems = [],
    getWorktreeContextActions,
    getWorktreeContextMenuState,
    getWorktreeRenderPaneState,
    onInvokeWorktreeContextAction,
    onToggleWorktreeContextMenu,
    onToggleWorktreeRenderPane,
    signal,
  } = options;

  const hasWorktreeTools = worktreeItems.length > 0
    || getWorktreeContextActions
    || getWorktreeContextMenuState
    || getWorktreeRenderPaneState
    || onInvokeWorktreeContextAction
    || onToggleWorktreeContextMenu
    || onToggleWorktreeRenderPane;
  if (!hasWorktreeTools) {
    return;
  }

  modelContext.registerTool({
    name: 'list_worktree_items',
    title: 'List worktree items',
    description: 'List actionable worktree items from the active workspace tree.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    execute: async () => normalizeWorktreeItems(worktreeItems),
    annotations: { readOnlyHint: true },
  }, { signal });

  if (getWorktreeRenderPaneState) {
    modelContext.registerTool({
      name: 'read_worktree_render_pane_state',
      title: 'Read worktree render pane state',
      description: 'Read whether a worktree item currently has an open render pane.',
      inputSchema: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          itemType: { type: 'string' },
        },
        required: ['itemId', 'itemType'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const item = readWorktreeItem(worktreeItems, input as WorktreeItemInput);
        return toWorktreeRenderPaneState(item, getWorktreeRenderPaneState({ itemId: item.id, itemType: item.itemType }));
      },
      annotations: { readOnlyHint: true },
    }, { signal });
  }

  if (onToggleWorktreeRenderPane) {
    modelContext.registerTool({
      name: 'toggle_worktree_render_pane',
      title: 'Toggle worktree render pane',
      description: 'Toggle the render pane visibility for a worktree item.',
      inputSchema: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          itemType: { type: 'string' },
        },
        required: ['itemId', 'itemType'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const item = readWorktreeItem(worktreeItems, input as WorktreeItemInput);
        const result = await onToggleWorktreeRenderPane({ itemId: item.id, itemType: item.itemType });
        return toWorktreeRenderPaneState(
          item,
          result ?? getWorktreeRenderPaneState?.({ itemId: item.id, itemType: item.itemType }),
        );
      },
    }, { signal });
  }

  if (getWorktreeContextMenuState) {
    modelContext.registerTool({
      name: 'read_worktree_context_menu_state',
      title: 'Read worktree context menu state',
      description: 'Read whether a worktree item currently has an open context menu.',
      inputSchema: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          itemType: { type: 'string' },
        },
        required: ['itemId', 'itemType'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const item = readWorktreeItem(worktreeItems, input as WorktreeItemInput);
        return toWorktreeContextMenuState(item, getWorktreeContextMenuState({ itemId: item.id, itemType: item.itemType }));
      },
      annotations: { readOnlyHint: true },
    }, { signal });
  }

  if (onToggleWorktreeContextMenu) {
    modelContext.registerTool({
      name: 'toggle_worktree_context_menu',
      title: 'Toggle worktree context menu',
      description: 'Toggle the context menu visibility for a worktree item.',
      inputSchema: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          itemType: { type: 'string' },
        },
        required: ['itemId', 'itemType'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const item = readWorktreeItem(worktreeItems, input as WorktreeItemInput);
        const result = await onToggleWorktreeContextMenu({ itemId: item.id, itemType: item.itemType });
        return toWorktreeContextMenuState(
          item,
          result ?? getWorktreeContextMenuState?.({ itemId: item.id, itemType: item.itemType }),
        );
      },
    }, { signal });
  }

  if (getWorktreeContextActions) {
    modelContext.registerTool({
      name: 'list_worktree_context_actions',
      title: 'List worktree context actions',
      description: 'List context menu actions available for a worktree item.',
      inputSchema: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          itemType: { type: 'string' },
        },
        required: ['itemId', 'itemType'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const item = readWorktreeItem(worktreeItems, input as WorktreeItemInput);
        return [...getWorktreeContextActions({ itemId: item.id, itemType: item.itemType })];
      },
      annotations: { readOnlyHint: true },
    }, { signal });
  }

  if (onInvokeWorktreeContextAction) {
    modelContext.registerTool({
      name: 'invoke_worktree_context_action',
      title: 'Invoke worktree context action',
      description: 'Invoke a context menu action for a worktree item.',
      inputSchema: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          itemType: { type: 'string' },
          actionId: { type: 'string' },
          args: { type: 'object', additionalProperties: true },
        },
        required: ['itemId', 'itemType', 'actionId'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as WorktreeActionInput;
        const item = readWorktreeItem(worktreeItems, typedInput);
        const actionId = String(typedInput.actionId ?? '').trim();
        if (!actionId) {
          throw new TypeError('Worktree context action input must include an actionId.');
        }
        return onInvokeWorktreeContextAction({
          itemId: item.id,
          itemType: item.itemType,
          actionId,
          args: isPlainObject(typedInput.args) ? typedInput.args : {},
        });
      },
    }, { signal });
  }
}
