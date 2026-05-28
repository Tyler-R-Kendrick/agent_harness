import { describe, expect, it, vi } from 'vitest';

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
});
