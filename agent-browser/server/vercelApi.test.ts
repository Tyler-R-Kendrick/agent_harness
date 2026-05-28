import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';

function jsonRequest({
  method = 'POST',
  url,
  body,
}: {
  method?: string;
  url: string;
  body?: unknown;
}) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  return {
    method,
    url,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  };
}

function jsonResponse() {
  const headers = new Map<string, string>();
  return {
    statusCode: 0,
    body: '',
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    end(value: string) {
      this.body = value;
    },
    json() {
      return JSON.parse(this.body);
    },
    headers,
  };
}

describe('Vercel web search API functions', () => {
  afterEach(() => {
    vi.doUnmock('jsdom');
    vi.resetModules();
  });

  it('keeps /api/web-search isolated from jsdom so the search function can deploy without page-reading dependencies', async () => {
    vi.resetModules();
    vi.doMock('jsdom', () => {
      throw new Error('web search API must not import jsdom');
    });

    const { createWebSearchApiHandler } = await import('../../api/web-search');
    const handler = createWebSearchApiHandler({
      search: vi.fn(async () => ({
        status: 'found' as const,
        query: 'movie theaters near Arlington Heights IL',
        results: [{ title: 'AMC Randhurst 12', url: 'https://example.com/amc', snippet: 'Movie theater.' }],
      })),
    });
    const req = jsonRequest({
      url: '/api/web-search',
      body: { query: 'movie theaters near Arlington Heights IL', limit: 3 },
    });
    const res = jsonResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'found' });
  });

  it('keeps /api/web-page isolated from jsdom so the page function can deploy as CommonJS', async () => {
    vi.resetModules();
    vi.doMock('jsdom', () => {
      throw new Error('web page API must not import jsdom');
    });

    const { createWebPageApiHandler } = await import('../../api/web-page');
    const handler = createWebPageApiHandler({
      read: vi.fn(async () => ({
        status: 'read' as const,
        url: 'https://example.com/',
        title: 'Example Domain',
        text: 'Example Domain',
        links: [],
        jsonLd: [],
        entities: [],
        observations: [],
      })),
    });
    const req = jsonRequest({
      url: '/api/web-page',
      body: { url: 'https://example.com/' },
    });
    const res = jsonResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'read', title: 'Example Domain' });
  });

  it('uses a CommonJS-safe web-search runtime for the deployed API handler', async () => {
    const source = await readFile(new URL('../../api/web-search.ts', import.meta.url), 'utf8');

    expect(source).toContain('./web-search-runtime');
    expect(source).not.toContain('../agent-browser/server/webSearchApi');
  });

  it('uses a CommonJS-safe web-page runtime for the deployed API handler', async () => {
    const source = await readFile(new URL('../../api/web-page.ts', import.meta.url), 'utf8');

    expect(source).toContain('./web-page-runtime');
    expect(source).not.toContain('../agent-browser/server/searchMiddleware');
  });

  it('serves /api/web-search from the deployed build instead of falling through to a 404', async () => {
    const { createWebSearchApiHandler } = await import('../../api/web-search');
    const search = vi.fn(async () => ({
      status: 'found' as const,
      query: 'movie theaters near Arlington Heights IL',
      results: [{
        title: 'AMC Randhurst 12',
        url: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12',
        snippet: 'Movie theater in Mount Prospect near Arlington Heights.',
      }],
    }));
    const handler = createWebSearchApiHandler({ search });
    const req = jsonRequest({
      url: '/api/web-search',
      body: { query: 'movie theaters near Arlington Heights IL', limit: 3 },
    });
    const res = jsonResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(search).toHaveBeenCalledWith({ query: 'movie theaters near Arlington Heights IL', limit: 3 });
    expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(res.json()).toEqual({
      status: 'found',
      query: 'movie theaters near Arlington Heights IL',
      results: [{
        title: 'AMC Randhurst 12',
        url: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12',
        snippet: 'Movie theater in Mount Prospect near Arlington Heights.',
      }],
    });
  });

  it('serves /api/web-page from the deployed build so search results can be validated', async () => {
    const { createWebPageApiHandler } = await import('../../api/web-page');
    const read = vi.fn(async () => ({
      status: 'read' as const,
      url: 'https://example.com/theaters',
      title: 'Theaters near Arlington Heights',
      text: 'AMC Randhurst 12 is a nearby theater.',
      links: [],
      jsonLd: [],
      entities: [{
        name: 'AMC Randhurst 12',
        url: 'https://example.com/amc-randhurst-12',
        evidence: 'page text',
      }],
      observations: [],
    }));
    const handler = createWebPageApiHandler({ read });
    const req = jsonRequest({
      method: 'GET',
      url: '/api/web-page?url=https%3A%2F%2Fexample.com%2Ftheaters',
    });
    const res = jsonResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(read).toHaveBeenCalledWith({ url: 'https://example.com/theaters' });
    expect(res.json()).toMatchObject({
      status: 'read',
      url: 'https://example.com/theaters',
      entities: [expect.objectContaining({ name: 'AMC Randhurst 12' })],
    });
  });

  it('extracts page text and entities from the deployed web-page runtime', async () => {
    const { WebPageBridge } = await import('../../api/web-page-runtime');
    const fetchPage = vi.fn(async () => new Response(`
      <html>
        <head>
          <title>Example Domain</title>
          <script type="application/ld+json">
            {"@context":"https://schema.org","@type":"MovieTheater","name":"AMC Randhurst 12","url":"https://example.com/amc-randhurst-12"}
          </script>
        </head>
        <body>
          <h1>Example Domain</h1>
          <p>AMC Randhurst 12 is located near Arlington Heights.</p>
          <a href="/amc-randhurst-12">AMC Randhurst 12</a>
        </body>
      </html>
    `, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }));

    const result = await new WebPageBridge(fetchPage as never).read({ url: 'https://example.com/' });

    expect(fetchPage).toHaveBeenCalledWith('https://example.com/', expect.objectContaining({
      headers: expect.objectContaining({ Accept: 'text/html,application/xhtml+xml,text/plain' }),
      signal: expect.any(AbortSignal),
    }));
    expect(result).toMatchObject({
      status: 'read',
      url: 'https://example.com/',
      title: 'Example Domain',
      text: expect.stringContaining('AMC Randhurst 12 is located near Arlington Heights.'),
      entities: [expect.objectContaining({
        name: 'AMC Randhurst 12',
        url: 'https://example.com/amc-randhurst-12',
      })],
      links: [expect.objectContaining({
        text: 'AMC Randhurst 12',
        url: 'https://example.com/amc-randhurst-12',
      })],
    });
  });
});
