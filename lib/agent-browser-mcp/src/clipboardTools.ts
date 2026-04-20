import { ModelContext } from '../../webmcp/src/index';

import type { RegisterWorkspaceToolsOptions, WorkspaceMcpClipboardEntry } from './workspaceToolTypes';

function readClipboardEntry(entries: readonly WorkspaceMcpClipboardEntry[], entryId: string): WorkspaceMcpClipboardEntry {
  const entry = entries.find((candidate) => candidate.id === entryId);
  if (!entry) {
    throw new DOMException(`Clipboard entry "${entryId}" is not available.`, 'NotFoundError');
  }

  return entry;
}

export function registerClipboardTools(modelContext: ModelContext, options: RegisterWorkspaceToolsOptions): void {
  const {
    clipboardEntries = [],
    onRestoreClipboardEntry,
    signal,
  } = options;

  const hasClipboardTools = clipboardEntries.length > 0 || onRestoreClipboardEntry;
  if (!hasClipboardTools) {
    return;
  }

  modelContext.registerTool({
    name: 'list_clipboard_history',
    title: 'List clipboard history',
    description: 'List clipboard history entries available in the active workspace.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    execute: async () => [...clipboardEntries],
    annotations: { readOnlyHint: true },
  }, { signal });

  modelContext.registerTool({
    name: 'read_clipboard_entry',
    title: 'Read clipboard entry',
    description: 'Read a clipboard history entry from the active workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        entryId: { type: 'string' },
      },
      required: ['entryId'],
      additionalProperties: false,
    },
    execute: async (input: object) => readClipboardEntry(clipboardEntries, String((input as { entryId?: string }).entryId ?? '').trim()),
    annotations: { readOnlyHint: true },
  }, { signal });

  if (onRestoreClipboardEntry) {
    modelContext.registerTool({
      name: 'restore_clipboard_entry',
      title: 'Restore clipboard entry',
      description: 'Restore a clipboard history entry into the active clipboard.',
      inputSchema: {
        type: 'object',
        properties: {
          entryId: { type: 'string' },
        },
        required: ['entryId'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const entryId = String((input as { entryId?: string }).entryId ?? '').trim();
        const entry = readClipboardEntry(clipboardEntries, entryId);
        const result = await onRestoreClipboardEntry(entry.id);
        if (result && typeof result === 'object' && !Array.isArray(result)
          && typeof (result as { id?: unknown }).id === 'string'
          && typeof (result as { text?: unknown }).text === 'string') {
          return result;
        }
        return { ...entry, isActive: true };
      },
    }, { signal });
  }
}