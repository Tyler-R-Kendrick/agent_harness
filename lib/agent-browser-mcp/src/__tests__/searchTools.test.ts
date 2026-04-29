import { describe, expect, it, vi } from 'vitest';
import { ModelContext } from '../../../webmcp/src/index';

import { createWebMcpTool } from '../tool';
import { registerWorkspaceTools } from '../workspaceTools';

describe('registerSearchTools', () => {
  it('registers search_web and forwards normalized requests to the app provider', async () => {
    const modelContext = new ModelContext();
    const onSearchWeb = vi.fn(async ({ query, limit }: { query: string; limit: number }) => ({
      status: 'found' as const,
      query,
      results: [{
        title: 'Mitsuwa Marketplace',
        url: 'https://example.com/mitsuwa',
        snippet: `Japanese market and dining result limit ${limit}.`,
      }],
    }));

    (registerWorkspaceTools as (context: ModelContext, options: Record<string, unknown>) => void)(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      onSearchWeb,
    });

    const webmcpTool = createWebMcpTool(modelContext);
    await expect(webmcpTool.execute?.({
      tool: 'search_web',
      args: { query: '  best restaurants Arlington Heights IL  ', limit: 3 },
    }, {} as never)).resolves.toEqual({
      status: 'found',
      query: 'best restaurants Arlington Heights IL',
      results: [{
        title: 'Mitsuwa Marketplace',
        url: 'https://example.com/mitsuwa',
        snippet: 'Japanese market and dining result limit 3.',
      }],
    });

    expect(onSearchWeb).toHaveBeenCalledWith({
      query: 'best restaurants Arlington Heights IL',
      limit: 3,
    });
  });

  it('returns unavailable when no app provider is configured', async () => {
    const modelContext = new ModelContext();
    (registerWorkspaceTools as (context: ModelContext, options: Record<string, unknown>) => void)(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
    });

    const webmcpTool = createWebMcpTool(modelContext);
    await expect(webmcpTool.execute?.({
      tool: 'search_web',
      args: { query: 'best restaurants Arlington Heights IL' },
    }, {} as never)).resolves.toEqual({
      status: 'unavailable',
      query: 'best restaurants Arlington Heights IL',
      reason: 'Web search is not configured for this workspace.',
      results: [],
    });
  });

  it('rejects empty queries and clamps invalid limits before provider calls', async () => {
    const modelContext = new ModelContext();
    const onSearchWeb = vi.fn(async ({ query, limit }: { query: string; limit: number }) => ({
      status: 'empty' as const,
      query,
      results: [],
      reason: `limit:${limit}`,
    }));

    (registerWorkspaceTools as (context: ModelContext, options: Record<string, unknown>) => void)(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      onSearchWeb,
    });

    const webmcpTool = createWebMcpTool(modelContext);
    await expect(webmcpTool.execute?.({
      tool: 'search_web',
      args: { query: '   ' },
    }, {} as never)).rejects.toThrow('Search query must not be empty.');
    await expect(webmcpTool.execute?.({
      tool: 'search_web',
      args: { query: 'pizza', limit: 100 },
    }, {} as never)).resolves.toEqual({
      status: 'empty',
      query: 'pizza',
      results: [],
      reason: 'limit:10',
    });
  });

  it('uses the normalized request query when provider omits its query echo', async () => {
    const modelContext = new ModelContext();
    const onSearchWeb = vi.fn(async () => ({
      status: 'found' as const,
      query: '   ',
      results: [{
        title: '  Passero  ',
        url: '  https://example.com/passero  ',
        snippet: '  Italian restaurant.  ',
      }],
    }));

    (registerWorkspaceTools as (context: ModelContext, options: Record<string, unknown>) => void)(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      onSearchWeb,
    });

    const webmcpTool = createWebMcpTool(modelContext);
    await expect(webmcpTool.execute?.({
      tool: 'search_web',
      args: { query: '  Italian restaurants  ' },
    }, {} as never)).resolves.toEqual({
      status: 'found',
      query: 'Italian restaurants',
      results: [{
        title: 'Passero',
        url: 'https://example.com/passero',
        snippet: 'Italian restaurant.',
      }],
    });
  });

  it('registers read_web_page and forwards normalized page-read requests to the app provider', async () => {
    const modelContext = new ModelContext();
    const onReadWebPage = vi.fn(async ({ url }: { url: string }) => ({
      status: 'read' as const,
      url,
      title: 'Movie Showtimes',
      text: 'AMC Randhurst 12 and CMX Arlington Heights are nearby theaters.',
      links: [{ text: 'AMC Randhurst 12', url: 'https://example.com/amc-randhurst-12' }],
      jsonLd: [{ '@type': 'MovieTheater', name: 'AMC Randhurst 12' }],
      entities: [{ name: 'AMC Randhurst 12', url: 'https://example.com/amc-randhurst-12', evidence: 'JSON-LD name' }],
      observations: [
        {
          kind: 'page-link',
          label: '  Sign In/Join  ',
          url: '  https://example.com/login  ',
          evidence: '  page link  ',
          sourceUrl: url,
        },
        {
          kind: 'text-span',
          label: '  AMC Randhurst 12  ',
          evidence: '  page text  ',
          localContext: '  AMC Randhurst 12 is a theater near Arlington Heights.  ',
          sourceUrl: url,
        },
      ],
    }));

    (registerWorkspaceTools as (context: ModelContext, options: Record<string, unknown>) => void)(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      onReadWebPage,
    });

    const webmcpTool = createWebMcpTool(modelContext);
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: '  https://example.com/theaters  ' },
    }, {} as never)).resolves.toEqual({
      status: 'read',
      url: 'https://example.com/theaters',
      title: 'Movie Showtimes',
      text: 'AMC Randhurst 12 and CMX Arlington Heights are nearby theaters.',
      links: [{ text: 'AMC Randhurst 12', url: 'https://example.com/amc-randhurst-12' }],
      jsonLd: [{ '@type': 'MovieTheater', name: 'AMC Randhurst 12' }],
      entities: [{ name: 'AMC Randhurst 12', url: 'https://example.com/amc-randhurst-12', evidence: 'JSON-LD name' }],
      observations: [
        {
          kind: 'page-link',
          label: 'Sign In/Join',
          url: 'https://example.com/login',
          evidence: 'page link',
          sourceUrl: 'https://example.com/theaters',
        },
        {
          kind: 'text-span',
          label: 'AMC Randhurst 12',
          evidence: 'page text',
          localContext: 'AMC Randhurst 12 is a theater near Arlington Heights.',
          sourceUrl: 'https://example.com/theaters',
        },
      ],
    });

    expect(onReadWebPage).toHaveBeenCalledWith({ url: 'https://example.com/theaters' });
  });

  it('returns unavailable when read_web_page has no app provider', async () => {
    const modelContext = new ModelContext();
    (registerWorkspaceTools as (context: ModelContext, options: Record<string, unknown>) => void)(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
    });

    const webmcpTool = createWebMcpTool(modelContext);
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'https://example.com/theaters' },
    }, {} as never)).resolves.toEqual({
      status: 'unavailable',
      url: 'https://example.com/theaters',
      reason: 'Web page reading is not configured for this workspace.',
      title: undefined,
      text: undefined,
      links: [],
      jsonLd: [],
      entities: [],
      observations: [],
    });
  });

  it('rejects empty, invalid, and non-http web page URLs before provider calls', async () => {
    const modelContext = new ModelContext();
    const onReadWebPage = vi.fn();
    (registerWorkspaceTools as (context: ModelContext, options: Record<string, unknown>) => void)(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      onReadWebPage,
    });

    const webmcpTool = createWebMcpTool(modelContext);
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: '   ' },
    }, {} as never)).rejects.toThrow('Web page URL must not be empty.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'not a url' },
    }, {} as never)).rejects.toThrow('Web page URL must be a valid absolute URL.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'file:///tmp/secret.txt' },
    }, {} as never)).rejects.toThrow('Only http and https URLs can be read.');
    expect(onReadWebPage).not.toHaveBeenCalled();
  });

  it('normalizes sparse read_web_page provider results', async () => {
    const modelContext = new ModelContext();
    const onReadWebPage = vi.fn(async () => ({
      status: 'unavailable' as const,
      url: '   ',
      title: '   ',
      text: '   ',
      links: [
        { text: '  Valid Link  ', url: '  https://example.com/valid  ' },
        { text: '  ', url: 'https://example.com/blank' },
      ],
      jsonLd: [],
      entities: [
        { name: '  Valid Entity  ', evidence: '  page text  ' },
        { name: 'Blank Evidence', evidence: '   ' },
      ],
      observations: [
        {
          kind: 'page-link',
          label: '  Valid Link  ',
          url: '  https://example.com/valid  ',
          evidence: '  page link  ',
          sourceUrl: '  https://example.com/source  ',
        },
        {
          kind: 'text-span',
          label: '   ',
          evidence: 'page text',
          sourceUrl: 'https://example.com/source',
        },
      ],
      reason: '  blocked by provider  ',
    }));
    (registerWorkspaceTools as (context: ModelContext, options: Record<string, unknown>) => void)(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      onReadWebPage,
    });

    const webmcpTool = createWebMcpTool(modelContext);
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'https://example.com/source' },
    }, {} as never)).resolves.toEqual({
      status: 'unavailable',
      url: 'https://example.com/source',
      title: undefined,
      text: undefined,
      links: [{ text: 'Valid Link', url: 'https://example.com/valid' }],
      jsonLd: [],
      entities: [{ name: 'Valid Entity', evidence: 'page text' }],
      observations: [{
        kind: 'page-link',
        label: 'Valid Link',
        url: 'https://example.com/valid',
        evidence: 'page link',
        sourceUrl: 'https://example.com/source',
      }],
      reason: 'blocked by provider',
    });
  });

  it('normalizes read_web_page provider results that omit observations', async () => {
    const modelContext = new ModelContext();
    const onReadWebPage = vi.fn(async () => ({
      status: 'read' as const,
      url: 'https://example.com/no-observations',
      links: [],
      jsonLd: [],
      entities: [],
    }));
    (registerWorkspaceTools as (context: ModelContext, options: Record<string, unknown>) => void)(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      onReadWebPage,
    });

    const webmcpTool = createWebMcpTool(modelContext);
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'https://example.com/no-observations' },
    }, {} as never)).resolves.toEqual({
      status: 'read',
      url: 'https://example.com/no-observations',
      title: undefined,
      text: undefined,
      links: [],
      jsonLd: [],
      entities: [],
      observations: [],
    });
  });
});
