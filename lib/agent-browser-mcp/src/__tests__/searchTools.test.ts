import { describe, expect, it, vi } from 'vitest';
import { ModelContext } from '../../../webmcp/src/index';

import { __testOnlySearchTools } from '../searchTools';
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

  it('rejects loopback and private-network web page URLs before provider calls', async () => {
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
      args: { url: 'http://localhost:4173/private' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://api.localhost/private' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://localhost./private' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'https://127.0.0.1:8443/private' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://10.0.0.8/internal' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://100.64.0.8/internal' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://172.20.0.8/internal' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://192.168.1.50/internal' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://198.18.0.8/internal' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://198.19.0.8/internal' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://169.254.169.254/latest/meta-data' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://0.0.0.0/internal' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://[::1]/private' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://[fe80::1]/private' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://[fd00::1]/private' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://[::ffff:127.0.0.1]/private' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://[::127.0.0.1]/private' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://[::a00:1]/private' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://[64:ff9b::7f00:1]/private' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://[64:ff9b::a00:1]/private' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://[2002:7f00:1::]/private' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://[2002:a00:1::]/private' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://127.0.0.1.nip.io/private' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://localhost.nip.io/private' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'http://127.0.0.1.sslip.io/private' },
    }, {} as never)).rejects.toThrow('Web page URL must target a public web host.');
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'https://user:pass@example.com/private' },
    }, {} as never)).rejects.toThrow('Web page URL must not include embedded credentials.');
    expect(onReadWebPage).not.toHaveBeenCalled();
  });

  it('allows public IPv6 web page URLs', async () => {
    const modelContext = new ModelContext();
    const onReadWebPage = vi.fn(async ({ url }: { url: string }) => ({
      status: 'read' as const,
      url,
      links: [],
      jsonLd: [],
      entities: [],
      observations: [],
    }));
    (registerWorkspaceTools as (context: ModelContext, options: Record<string, unknown>) => void)(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      onReadWebPage,
    });

    const webmcpTool = createWebMcpTool(modelContext);
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'https://[2606:4700:4700::1111]/dns-query' },
    }, {} as never)).resolves.toEqual({
      status: 'read',
      url: 'https://[2606:4700:4700::1111]/dns-query',
      title: undefined,
      text: undefined,
      links: [],
      jsonLd: [],
      entities: [],
      observations: [],
    });
    expect(onReadWebPage).toHaveBeenCalledWith({ url: 'https://[2606:4700:4700::1111]/dns-query' });

    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'https://[2001:db8:1:2:3:4:5:6]/dns-query' },
    }, {} as never)).resolves.toEqual({
      status: 'read',
      url: 'https://[2001:db8:1:2:3:4:5:6]/dns-query',
      title: undefined,
      text: undefined,
      links: [],
      jsonLd: [],
      entities: [],
      observations: [],
    });
    expect(onReadWebPage).toHaveBeenCalledWith({ url: 'https://[2001:db8:1:2:3:4:5:6]/dns-query' });

    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'https://[64:ff9b::808:808]/dns-query' },
    }, {} as never)).resolves.toEqual({
      status: 'read',
      url: 'https://[64:ff9b::808:808]/dns-query',
      title: undefined,
      text: undefined,
      links: [],
      jsonLd: [],
      entities: [],
      observations: [],
    });
    expect(onReadWebPage).toHaveBeenCalledWith({ url: 'https://[64:ff9b::808:808]/dns-query' });
  });

  it('allows public IPv4 web page URLs', async () => {
    const modelContext = new ModelContext();
    const onReadWebPage = vi.fn(async ({ url }: { url: string }) => ({
      status: 'read' as const,
      url,
      links: [],
      jsonLd: [],
      entities: [],
      observations: [],
    }));
    (registerWorkspaceTools as (context: ModelContext, options: Record<string, unknown>) => void)(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      onReadWebPage,
    });

    const webmcpTool = createWebMcpTool(modelContext);
    await expect(webmcpTool.execute?.({
      tool: 'read_web_page',
      args: { url: 'https://8.8.8.8/dns-query' },
    }, {} as never)).resolves.toEqual({
      status: 'read',
      url: 'https://8.8.8.8/dns-query',
      title: undefined,
      text: undefined,
      links: [],
      jsonLd: [],
      entities: [],
      observations: [],
    });
    expect(onReadWebPage).toHaveBeenCalledWith({ url: 'https://8.8.8.8/dns-query' });
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

  it('rejects malformed IPv6 helpers and recognizes loopback wildcard DNS hostnames', () => {
    expect(__testOnlySearchTools.parseIpv6Segments('2001::1::1')).toBeNull();
    expect(__testOnlySearchTools.parseIpv6Segments('100000::1')).toBeNull();
    expect(__testOnlySearchTools.parseIpv6Segments('2001:db8:1:2:3:4:5')).toBeNull();
    expect(__testOnlySearchTools.parseIpv6Segments('1:2:3:4:5:6:7:8::1')).toBeNull();
    expect(__testOnlySearchTools.extractEmbeddedIpv4SegmentsFromIpv6('2001::1::1')).toBeNull();
    expect(__testOnlySearchTools.isLoopbackDnsHostname('localhost.nip.io')).toBe(true);
    expect(__testOnlySearchTools.isLoopbackDnsHostname('8.8.8.8.nip.io')).toBe(false);
  });
});
