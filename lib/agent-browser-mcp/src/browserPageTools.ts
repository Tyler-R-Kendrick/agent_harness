import { ModelContext } from '../../webmcp/src/index';

import type { RegisterWorkspaceToolsOptions } from './workspaceToolTypes';
import type { BrowserPageInput } from './workspaceToolShared';
import {
  normalizeBrowserPageMutationResult,
  readBrowserPage,
  toBrowserPageResult,
} from './workspaceToolShared';

export function registerBrowserPageSurface(modelContext: ModelContext, options: RegisterWorkspaceToolsOptions): void {
  const {
    browserPages = [],
    getBrowserPageHistory,
    onCreateBrowserPage,
    onNavigateBrowserPage,
    onNavigateBrowserPageHistory,
    onRefreshBrowserPage,
    signal,
  } = options;

  const hasBrowserTools = browserPages.length > 0
    || getBrowserPageHistory
    || onCreateBrowserPage
    || onNavigateBrowserPage
    || onNavigateBrowserPageHistory
    || onRefreshBrowserPage;
  if (!hasBrowserTools) {
    return;
  }

  const toBrowserPageActionResult = (action: 'navigate' | 'refresh', pageId: string, result: unknown) => {
    if (result && typeof result === 'object' && !Array.isArray(result)
      && typeof (result as { id?: unknown }).id === 'string'
      && typeof (result as { title?: unknown }).title === 'string'
      && typeof (result as { url?: unknown }).url === 'string') {
      return toBrowserPageResult(result as RegisterWorkspaceToolsOptions['browserPages'][number]);
    }

    return { pageId, [action]: true };
  };

  const toBrowserPageHistoryActionResult = (pageId: string, direction: 'back' | 'forward', result: unknown) => {
    if (result && typeof result === 'object' && !Array.isArray(result)
      && typeof (result as { id?: unknown }).id === 'string'
      && typeof (result as { title?: unknown }).title === 'string'
      && typeof (result as { url?: unknown }).url === 'string') {
      return toBrowserPageResult(result as RegisterWorkspaceToolsOptions['browserPages'][number]);
    }

    return { pageId, direction };
  };

  modelContext.registerTool({
    name: 'list_browser_pages',
    title: 'List browser pages',
    description: 'List browser pages in the active workspace, optionally filtering by page title.',
    inputSchema: {
      type: 'object',
      properties: {
        titleQuery: { type: 'string' },
      },
      additionalProperties: false,
    },
    execute: async (input: object) => {
      const titleQuery = String((input as { titleQuery?: string }).titleQuery ?? '').trim().toLocaleLowerCase();
      return browserPages
        .filter((page) => !titleQuery || page.title.toLocaleLowerCase().includes(titleQuery))
        .map(toBrowserPageResult);
    },
    annotations: { readOnlyHint: true },
  }, { signal });

  modelContext.registerTool({
    name: 'read_browser_page',
    title: 'Read browser page',
    description: 'Read browser page metadata from the active workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
      },
      required: ['pageId'],
      additionalProperties: false,
    },
    execute: async (input: object) => toBrowserPageResult(readBrowserPage(browserPages, input as BrowserPageInput)),
    annotations: { readOnlyHint: true },
  }, { signal });

  if (getBrowserPageHistory) {
    modelContext.registerTool({
      name: 'read_browser_page_history',
      title: 'Read browser page history',
      description: 'Read browser navigation history for a browser page in the active workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          pageId: { type: 'string' },
        },
        required: ['pageId'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const page = readBrowserPage(browserPages, input as BrowserPageInput);
        return getBrowserPageHistory(page.id) ?? { pageId: page.id, currentIndex: 0, entries: [] };
      },
      annotations: { readOnlyHint: true },
    }, { signal });
  }

  if (onCreateBrowserPage) {
    modelContext.registerTool({
      name: 'create_browser_page',
      title: 'Create browser page',
      description: 'Create a browser page in the active workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          title: { type: 'string' },
        },
        required: ['url'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as { url?: string; title?: string };
        const url = String(typedInput.url ?? '').trim();
        if (!url) {
          throw new TypeError('Browser page creation requires a url.');
        }
        const title = typeof typedInput.title === 'string' && typedInput.title.trim() ? typedInput.title.trim() : undefined;
        const result = await onCreateBrowserPage({ url, title });
        return normalizeBrowserPageMutationResult('create', '', result);
      },
    }, { signal });
  }

  if (onNavigateBrowserPage) {
    modelContext.registerTool({
      name: 'navigate_browser_page',
      title: 'Navigate browser page',
      description: 'Navigate an existing browser page to a new URI in the active workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          pageId: { type: 'string' },
          url: { type: 'string' },
          title: { type: 'string' },
        },
        required: ['pageId', 'url'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as { pageId?: string; url?: string; title?: string };
        const page = readBrowserPage(browserPages, typedInput as BrowserPageInput);
        const url = String(typedInput.url ?? '').trim();
        if (!url) {
          throw new TypeError('Browser navigation requires a url.');
        }
        const title = typeof typedInput.title === 'string' && typedInput.title.trim() ? typedInput.title.trim() : undefined;
        const result = await onNavigateBrowserPage({ pageId: page.id, url, title });
        return toBrowserPageActionResult('navigate', page.id, result);
      },
    }, { signal });
  }

  if (onNavigateBrowserPageHistory) {
    modelContext.registerTool({
      name: 'navigate_browser_page_history',
      title: 'Navigate browser page history',
      description: 'Navigate backward or forward in browser page history for an existing page in the active workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          pageId: { type: 'string' },
          direction: { type: 'string', enum: ['back', 'forward'] },
        },
        required: ['pageId', 'direction'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as BrowserPageInput & { direction?: string };
        const page = readBrowserPage(browserPages, typedInput);
        if (typedInput.direction !== 'back' && typedInput.direction !== 'forward') {
          throw new TypeError('Browser history navigation requires a direction of back or forward.');
        }
        const result = await onNavigateBrowserPageHistory({ pageId: page.id, direction: typedInput.direction });
        return toBrowserPageHistoryActionResult(page.id, typedInput.direction, result);
      },
    }, { signal });
  }

  if (onRefreshBrowserPage) {
    modelContext.registerTool({
      name: 'refresh_browser_page',
      title: 'Refresh browser page',
      description: 'Refresh a browser page in the active workspace without changing history position.',
      inputSchema: {
        type: 'object',
        properties: {
          pageId: { type: 'string' },
        },
        required: ['pageId'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const page = readBrowserPage(browserPages, input as BrowserPageInput);
        const result = await onRefreshBrowserPage(page.id);
        return toBrowserPageActionResult('refresh', page.id, result);
      },
    }, { signal });
  }
}