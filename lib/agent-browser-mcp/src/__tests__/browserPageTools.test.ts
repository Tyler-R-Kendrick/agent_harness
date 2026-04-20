import { describe, expect, it, vi } from 'vitest';
import { getModelContextRegistry, ModelContext } from '../../../webmcp/src/index';
import { registerBrowserPageSurface } from '../browserPageTools';
import { createWebMcpTool } from '../tool';

const BROWSER_PAGES = [
  { id: 'page-1', title: 'Home', url: 'https://example.com', isOpen: true },
  { id: 'page-2', title: 'Docs', url: 'https://example.com/docs', isOpen: false },
];

describe('registerBrowserPageSurface', () => {
  it('registers no tools when no pages or callbacks are provided', () => {
    const modelContext = new ModelContext();
    registerBrowserPageSurface(modelContext, { workspaceName: 'Research' });
    expect(getModelContextRegistry(modelContext).list()).toHaveLength(0);
  });

  describe('read_browser_page_history', () => {
    it('returns history from getBrowserPageHistory callback', async () => {
      const modelContext = new ModelContext();
      const history = { pageId: 'page-1', currentIndex: 1, entries: [{ url: 'https://example.com', title: 'Home', timestamp: 1 }] };
      registerBrowserPageSurface(modelContext, {
        workspaceName: 'Research',
        browserPages: BROWSER_PAGES,
        getBrowserPageHistory: vi.fn(() => history),
      });

      const tool = createWebMcpTool(modelContext);
      const result = await tool.execute?.({ tool: 'read_browser_page_history', args: { pageId: 'page-1' } }, {} as never);
      expect(result).toEqual(history);
    });

    it('returns empty history fallback when getBrowserPageHistory returns null', async () => {
      const modelContext = new ModelContext();
      registerBrowserPageSurface(modelContext, {
        workspaceName: 'Research',
        browserPages: BROWSER_PAGES,
        getBrowserPageHistory: vi.fn(() => null),
      });

      const tool = createWebMcpTool(modelContext);
      const result = await tool.execute?.({ tool: 'read_browser_page_history', args: { pageId: 'page-1' } }, {} as never);
      expect(result).toEqual({ pageId: 'page-1', currentIndex: 0, entries: [] });
    });
  });

  describe('navigate_browser_page', () => {
    it('throws TypeError when url is missing', async () => {
      const modelContext = new ModelContext();
      registerBrowserPageSurface(modelContext, {
        workspaceName: 'Research',
        browserPages: BROWSER_PAGES,
        onNavigateBrowserPage: vi.fn(async () => undefined),
      });

      const tool = createWebMcpTool(modelContext);
      await expect(
        tool.execute?.({ tool: 'navigate_browser_page', args: { pageId: 'page-1' } }, {} as never),
      ).rejects.toThrow('url');
    });

    it('passes title to onNavigateBrowserPage when provided', async () => {
      const modelContext = new ModelContext();
      const onNavigateBrowserPage = vi.fn(async () => undefined);
      registerBrowserPageSurface(modelContext, {
        workspaceName: 'Research',
        browserPages: BROWSER_PAGES,
        onNavigateBrowserPage,
      });

      const tool = createWebMcpTool(modelContext);
      await tool.execute?.({ tool: 'navigate_browser_page', args: { pageId: 'page-1', url: 'https://example.com/new', title: 'New Title' } }, {} as never);
      expect(onNavigateBrowserPage).toHaveBeenCalledWith({ pageId: 'page-1', url: 'https://example.com/new', title: 'New Title' });
    });

    it('omits title when blank string is provided', async () => {
      const modelContext = new ModelContext();
      const onNavigateBrowserPage = vi.fn(async () => undefined);
      registerBrowserPageSurface(modelContext, {
        workspaceName: 'Research',
        browserPages: BROWSER_PAGES,
        onNavigateBrowserPage,
      });

      const tool = createWebMcpTool(modelContext);
      await tool.execute?.({ tool: 'navigate_browser_page', args: { pageId: 'page-1', url: 'https://example.com', title: '   ' } }, {} as never);
      expect(onNavigateBrowserPage).toHaveBeenCalledWith({ pageId: 'page-1', url: 'https://example.com', title: undefined });
    });

    it('throws TypeError when pageId is absent (covers ?? fallback branch)', async () => {
      const modelContext = new ModelContext();
      registerBrowserPageSurface(modelContext, {
        workspaceName: 'Research',
        browserPages: BROWSER_PAGES,
        onNavigateBrowserPage: vi.fn(async () => undefined),
      });

      const tool = createWebMcpTool(modelContext);
      // No pageId → url ?? '' branch triggered; readBrowserPage throws TypeError for missing pageId
      await expect(
        tool.execute?.({ tool: 'navigate_browser_page', args: { url: 'https://example.com' } }, {} as never),
      ).rejects.toThrow('pageId');
    });
  });
});
