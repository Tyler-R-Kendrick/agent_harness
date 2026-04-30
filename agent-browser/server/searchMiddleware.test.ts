import { describe, expect, it, vi } from 'vitest';
import { createSearchApiMiddleware, createWebPageApiMiddleware, WebPageBridge, WebSearchBridge } from './searchMiddleware';

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
  };
}

describe('WebSearchBridge', () => {
  it('normalizes public search results from the provider HTML', async () => {
    const fetchImpl = vi.fn(async () => new Response(`
      <html>
        <body>
          <a class="result__a" href="https://example.com/mitsuwa">Mitsuwa Marketplace</a>
          <a class="result__snippet">Japanese market and food court in Arlington Heights.</a>
          <a class="result__a" href="https://example.com/passero">Passero</a>
          <a class="result__snippet">Italian restaurant in Arlington Heights.</a>
        </body>
      </html>
    `, { status: 200 }));
    const bridge = new WebSearchBridge(fetchImpl);

    await expect(bridge.search({ query: 'best restaurants Arlington Heights IL', limit: 1 })).resolves.toEqual({
      status: 'found',
      query: 'best restaurants Arlington Heights IL',
      results: [{
        title: 'Mitsuwa Marketplace',
        url: 'https://example.com/mitsuwa',
        snippet: 'Japanese market and food court in Arlington Heights.',
      }],
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://duckduckgo.com/html/?q=best%20restaurants%20Arlington%20Heights%20IL',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('returns unavailable when the provider request fails', async () => {
    const bridge = new WebSearchBridge(vi.fn(async () => {
      throw new Error('network blocked');
    }));

    await expect(bridge.search({ query: 'pizza', limit: 3 })).resolves.toEqual({
      status: 'unavailable',
      query: 'pizza',
      reason: 'network blocked',
      results: [],
    });
  });

  it('returns unavailable instead of hanging when search providers do not respond', async () => {
    const fetchImpl = vi.fn(() => new Promise<Response>(() => {}));
    const bridge = new WebSearchBridge(fetchImpl, 1);

    await expect(bridge.search({ query: 'best parks Arlington Heights IL', limit: 3 })).resolves.toMatchObject({
      status: 'unavailable',
      query: 'best parks Arlington Heights IL',
      results: [],
      reason: expect.stringContaining('Fetch timed out after 1ms.'),
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://duckduckgo.com/html/?q=best%20parks%20Arlington%20Heights%20IL',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('falls back to another public search provider when the first provider blocks the request', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('blocked', { status: 403 }))
      .mockResolvedValueOnce(new Response('blocked', { status: 403 }))
      .mockResolvedValueOnce(new Response(`
        <html>
          <body>
            <li class="b_algo">
              <h2><a href="https://example.com/amc-randhurst">AMC Randhurst 12</a></h2>
              <p>Movie theater in Mount Prospect near Arlington Heights.</p>
            </li>
          </body>
        </html>
      `, { status: 200 }));
    const bridge = new WebSearchBridge(fetchImpl);

    await expect(bridge.search({ query: 'best movie theaters Arlington Heights IL', limit: 3 })).resolves.toEqual({
      status: 'found',
      query: 'best movie theaters Arlington Heights IL',
      results: [{
        title: 'AMC Randhurst 12',
        url: 'https://example.com/amc-randhurst',
        snippet: 'Movie theater in Mount Prospect near Arlington Heights.',
      }],
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      'https://www.bing.com/search?q=best%20movie%20theaters%20Arlington%20Heights%20IL',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('falls back to another public search provider when the first provider throws', async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce(new Response(`
        <html>
          <body>
            <li class="b_algo">
              <h2><a href="https://example.com/north-school-park">North School Park</a></h2>
              <p>Park in Arlington Heights, IL.</p>
            </li>
          </body>
        </html>
      `, { status: 200 }));
    const bridge = new WebSearchBridge(fetchImpl);

    await expect(bridge.search({ query: 'parks near Arlington Heights IL', limit: 3 })).resolves.toEqual({
      status: 'found',
      query: 'parks near Arlington Heights IL',
      results: [{
        title: 'North School Park',
        url: 'https://example.com/north-school-park',
        snippet: 'Park in Arlington Heights, IL.',
      }],
    });
  });

  it('decodes Bing redirect result URLs before returning search evidence', async () => {
    const destination = 'https://www.yelp.com/search?cflt=cafes&find_loc=Arlington+Heights%2C+IL';
    const encodedDestination = `a1${Buffer.from(destination).toString('base64url')}`;
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('blocked', { status: 403 }))
      .mockResolvedValueOnce(new Response('blocked', { status: 403 }))
      .mockResolvedValueOnce(new Response(`
        <html>
          <body>
            <li class="b_algo">
              <h2><a href="https://www.bing.com/ck/a?!&&u=${encodedDestination}&ntb=1">THE BEST 10 CAFES in ARLINGTON HEIGHTS, IL - Yelp</a></h2>
              <p>Best Cafes in Arlington Heights, IL - Two Libras Cafe, Jelly Cafe, Altea Viet Coffee &amp; Boba.</p>
            </li>
          </body>
        </html>
      `, { status: 200 }));
    const bridge = new WebSearchBridge(fetchImpl);

    await expect(bridge.search({ query: 'cafes names near Arlington Heights IL', limit: 3 })).resolves.toMatchObject({
      status: 'found',
      results: [{
        title: 'THE BEST 10 CAFES in ARLINGTON HEIGHTS, IL - Yelp',
        url: destination,
        snippet: 'Best Cafes in Arlington Heights, IL - Two Libras Cafe, Jelly Cafe, Altea Viet Coffee & Boba.',
      }],
    });
  });
});

describe('createSearchApiMiddleware', () => {
  it('handles the web-search route when the request URL includes search params', async () => {
    const search = vi.fn(async () => ({
      status: 'found' as const,
      query: 'best theaters Arlington Heights IL',
      results: [{ title: 'AMC Randhurst 12', url: 'https://example.com/amc', snippet: 'Theater near Arlington Heights.' }],
    }));
    const middleware = createSearchApiMiddleware({ search } as unknown as WebSearchBridge);
    const req = jsonRequest({
      url: '/api/web-search?source=google.com',
      body: { query: 'best theaters Arlington Heights IL', limit: 3 },
    });
    const res = jsonResponse();
    const next = vi.fn();

    await middleware(req as never, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(search).toHaveBeenCalledWith({ query: 'best theaters Arlington Heights IL', limit: 3 });
    expect(res.json()).toMatchObject({ status: 'found' });
  });

  it('supports GET queries so curl and HTTP-client fallbacks can search the same bridge', async () => {
    const search = vi.fn(async () => ({
      status: 'found' as const,
      query: 'best theaters Arlington Heights IL',
      results: [{ title: 'CMX Arlington Heights', url: 'https://example.com/cmx', snippet: 'Theater in Arlington Heights.' }],
    }));
    const middleware = createSearchApiMiddleware({ search } as unknown as WebSearchBridge);
    const req = jsonRequest({
      method: 'GET',
      url: '/api/web-search?query=best%20theaters%20Arlington%20Heights%20IL&limit=2',
    });
    const res = jsonResponse();

    await middleware(req as never, res as never, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(search).toHaveBeenCalledWith({ query: 'best theaters Arlington Heights IL', limit: 2 });
    expect(res.json()).toMatchObject({ status: 'found' });
  });
});

describe('WebPageBridge', () => {
  it('extracts generic page text, links, json-ld, and named entities', async () => {
    const fetchImpl = vi.fn(async () => new Response(`
      <html>
        <head>
          <title>Theaters near Arlington Heights</title>
          <script type="application/ld+json">
            [
              { "@type": "MovieTheater", "name": "AMC Randhurst 12", "url": "https://example.com/amc" },
              { "@type": "LocalBusiness", "name": "CMX Arlington Heights", "url": "https://example.com/cmx" }
            ]
          </script>
        </head>
        <body>
          <h2>AMC Randhurst 12</h2>
          <a href="/cmx">CMX Arlington Heights</a>
          <p>Classic Cinemas Elk Grove Theatre is another nearby option.</p>
        </body>
      </html>
    `, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }));
    const bridge = new WebPageBridge(fetchImpl);

    await expect(bridge.read({ url: 'https://example.com/theaters' })).resolves.toMatchObject({
      status: 'read',
      url: 'https://example.com/theaters',
      title: 'Theaters near Arlington Heights',
      links: [{ text: 'CMX Arlington Heights', url: 'https://example.com/cmx' }],
      jsonLd: [
        { '@type': 'MovieTheater', name: 'AMC Randhurst 12', url: 'https://example.com/amc' },
        { '@type': 'LocalBusiness', name: 'CMX Arlington Heights', url: 'https://example.com/cmx' },
      ],
      entities: expect.arrayContaining([
        { name: 'AMC Randhurst 12', url: 'https://example.com/amc', evidence: 'json-ld' },
        { name: 'CMX Arlington Heights', url: 'https://example.com/cmx', evidence: 'json-ld' },
        { name: 'Classic Cinemas Elk Grove Theatre', url: 'https://example.com/theaters', evidence: 'page text' },
      ]),
    });
  });

  it('reads the decoded Bing redirect destination instead of the redirect shell page', async () => {
    const destination = 'https://example.com/cafes';
    const encodedDestination = `a1${Buffer.from(destination).toString('base64url')}`;
    const fetchImpl = vi.fn(async () => new Response(`
      <html>
        <head><title>Cafes near Arlington Heights</title></head>
        <body>
          <p>Two Libras Cafe is a cafe near Arlington Heights.</p>
        </body>
      </html>
    `, { status: 200 }));
    const bridge = new WebPageBridge(fetchImpl);

    const result = await bridge.read({
      url: `https://www.bing.com/ck/a?!&&u=${encodedDestination}&ntb=1`,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      destination,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(result).toMatchObject({
      status: 'read',
      url: destination,
      title: 'Cafes near Arlington Heights',
    });
    expect(result.entities).toEqual(expect.arrayContaining([
      { name: 'Two Libras Cafe', url: destination, evidence: 'page text' },
    ]));
  });

  it('keeps untrusted page links as observations instead of entity candidates', async () => {
    const fetchImpl = vi.fn(async () => new Response(`
      <html>
        <head><title>Movie theaters near Arlington Heights, IL</title></head>
        <body>
          <nav>
            <a href="/tv">Moviefone TV</a>
            <a href="/login">Sign In/Join</a>
            <a href="/fanclub">FanClub</a>
          </nav>
          <main>
            <p>Moviefone TV is displayed in the global navigation for movie theaters near Arlington Heights, IL.</p>
            <p>AMC Randhurst 12 is a movie theater in Mount Prospect near Arlington Heights.</p>
          </main>
        </body>
      </html>
    `, { status: 200 }));
    const bridge = new WebPageBridge(fetchImpl);

    const result = await bridge.read({ url: 'https://www.moviefone.com/showtimes/theaters/arlington-heights-il/60004/' });

    expect(result.observations).toEqual(expect.arrayContaining([
      {
        kind: 'page-link',
        label: 'Moviefone TV',
        url: 'https://www.moviefone.com/tv',
        evidence: 'page link',
        sourceUrl: 'https://www.moviefone.com/showtimes/theaters/arlington-heights-il/60004/',
      },
      {
        kind: 'text-span',
        label: 'AMC Randhurst 12',
        evidence: 'page text',
        localContext: 'AMC Randhurst 12 is a movie theater in Mount Prospect near Arlington Heights.',
        sourceUrl: 'https://www.moviefone.com/showtimes/theaters/arlington-heights-il/60004/',
      },
    ]));
    expect(result.entities).toEqual(expect.arrayContaining([
      { name: 'AMC Randhurst 12', url: 'https://www.moviefone.com/showtimes/theaters/arlington-heights-il/60004/', evidence: 'page text' },
    ]));
    expect(result.entities).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Moviefone TV' }),
      expect.objectContaining({ name: 'Sign In/Join' }),
      expect.objectContaining({ name: 'FanClub' }),
    ]));
  });

  it('filters movie-time geography directory labels from page entities and observations', async () => {
    const fetchImpl = vi.fn(async () => new Response(`
      <html>
        <head><title>Movie theaters near Arlington Heights, IL</title></head>
        <script type="application/ld+json">
          { "@type": "MovieTheater", "name": "AMC Randhurst 12", "url": "https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12" }
        </script>
        <body>
          <main>
            <h2>Movie Times by Cities</h2>
            <a href="/movies-by-city">Cities Movie Times</a>
            <h2>Movie Times by States</h2>
            <a href="/movies-by-state">States Movie Times</a>
            <h2>Movie Times by Zip Codes</h2>
            <a href="/movie-times/movies-by-zip-code">Zip Codes Movie Times</a>
            <p>AMC Randhurst 12 is a movie theater in Mount Prospect near Arlington Heights.</p>
          </main>
        </body>
      </html>
    `, { status: 200 }));
    const bridge = new WebPageBridge(fetchImpl);

    const result = await bridge.read({ url: 'https://www.fandango.com/arlington-heights_il_movietimes' });

    expect(result.entities).toEqual(expect.arrayContaining([
      {
        name: 'AMC Randhurst 12',
        url: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12',
        evidence: 'json-ld',
      },
    ]));
    expect(result.entities).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Cities Movie Times' }),
      expect.objectContaining({ name: 'States Movie Times' }),
      expect.objectContaining({ name: 'Zip Codes Movie Times' }),
      expect.objectContaining({ name: 'Movie Times by Cities' }),
      expect.objectContaining({ name: 'Movie Times by States' }),
    ]));
    expect(result.observations).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Cities Movie Times' }),
      expect.objectContaining({ label: 'States Movie Times' }),
      expect.objectContaining({ label: 'Zip Codes Movie Times' }),
      expect.objectContaining({ label: 'Movie Times by Cities' }),
      expect.objectContaining({ label: 'Movie Times by States' }),
    ]));
  });

  it('keeps article metadata and chrome text as observations instead of requested entities', async () => {
    const fetchImpl = vi.fn(async () => new Response(`
      <html>
        <head>
          <title>Arlington Heights' Best Bars Spots [2026 Guide]</title>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Article",
              "headline": "Arlington Heights' Best Bars Spots [2026 Guide]",
              "author": { "@type": "Person", "name": "Chicago Bound" },
              "publisher": { "@type": "Organization", "name": "Chicago Bound" }
            }
          </script>
        </head>
        <body>
          <nav>
            <a href="/support">Support Enable</a>
            <a href="/join">Join Now Enable</a>
            <a href="/">Chicago Bound</a>
          </nav>
          <main>
            <p>Chicago Bound Shop Categories About Us Support Enable dark mode Join Now Enable dark mode.</p>
            <p>Sports Page Bar & Grill is a bar in Arlington Heights, IL.</p>
          </main>
        </body>
      </html>
    `, { status: 200 }));
    const bridge = new WebPageBridge(fetchImpl);

    const result = await bridge.read({ url: 'https://chicagobound.com/best-bars-in-arlington-heights-il' });

    expect(result.observations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'page-link', label: 'Support Enable' }),
      expect.objectContaining({ kind: 'page-link', label: 'Join Now Enable' }),
    ]));
    expect(result.entities).toEqual(expect.arrayContaining([
      {
        name: 'Sports Page Bar & Grill',
        url: 'https://chicagobound.com/best-bars-in-arlington-heights-il',
        evidence: 'page text',
      },
    ]));
    expect(result.entities).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Support Enable' }),
      expect.objectContaining({ name: 'Join Now Enable' }),
      expect.objectContaining({ name: 'Chicago Bound' }),
      expect.objectContaining({ name: "Arlington Heights' Best Bars Spots [2026 Guide]" }),
    ]));
  });

  it('does not extract script, style, or advertising text as page entities', async () => {
    const fetchImpl = vi.fn(async () => new Response(`
      <html>
        <head>
          <title>Movie theaters near Arlington Heights, IL</title>
          <style>
            body { font-family: "Palatino Linotype", Palatino, Georgia, serif; }
          </style>
          <script>
            window.Fandango = { adConfig: { units: ["Multi Logo", "Box Ad"] } };
          </script>
        </head>
        <body>
          <main>
            <p>AMC Randhurst 12 is a movie theater in Mount Prospect near Arlington Heights.</p>
          </main>
        </body>
      </html>
    `, { status: 200 }));
    const bridge = new WebPageBridge(fetchImpl);

    const result = await bridge.read({ url: 'https://www.fandango.com/arlington-heights_il_movietimes' });

    expect(result.text).toContain('AMC Randhurst 12');
    expect(result.text).not.toContain('Palatino Linotype');
    expect(result.text).not.toContain('Multi Logo');
    expect(result.text).not.toContain('Box Ad');
    expect(result.entities).toEqual(expect.arrayContaining([
      { name: 'AMC Randhurst 12', url: 'https://www.fandango.com/arlington-heights_il_movietimes', evidence: 'page text' },
    ]));
    expect(result.entities).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Palatino Linotype' }),
      expect.objectContaining({ name: 'Multi Logo' }),
      expect.objectContaining({ name: 'Box Ad' }),
    ]));
    expect(result.observations).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Palatino Linotype' }),
      expect.objectContaining({ label: 'Multi Logo' }),
      expect.objectContaining({ label: 'Box Ad' }),
    ]));
  });

  it('blocks non-http URLs before fetching', async () => {
    const fetchImpl = vi.fn();
    const bridge = new WebPageBridge(fetchImpl);

    await expect(bridge.read({ url: 'file:///etc/passwd' })).resolves.toEqual({
      status: 'blocked',
      url: 'file:///etc/passwd',
      reason: 'Only http and https URLs can be read.',
      links: [],
      jsonLd: [],
      entities: [],
      observations: [],
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns unavailable instead of hanging when a page read does not respond', async () => {
    const fetchImpl = vi.fn(() => new Promise<Response>(() => {}));
    const bridge = new WebPageBridge(fetchImpl, 1);

    await expect(bridge.read({ url: 'https://example.com/slow' })).resolves.toMatchObject({
      status: 'unavailable',
      url: 'https://example.com/slow',
      reason: 'Fetch timed out after 1ms.',
      links: [],
      jsonLd: [],
      entities: [],
      observations: [],
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/slow',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});

describe('createWebPageApiMiddleware', () => {
  it('supports GET URL reads so curl and HTTP-client fallbacks can read result pages', async () => {
    const read = vi.fn(async () => ({
      status: 'read' as const,
      url: 'https://example.com/theaters',
      title: 'Theaters',
      links: [],
      jsonLd: [],
      entities: [],
      observations: [],
    }));
    const middleware = createWebPageApiMiddleware({ read } as unknown as WebPageBridge);
    const req = jsonRequest({
      method: 'GET',
      url: '/api/web-page?url=https%3A%2F%2Fexample.com%2Ftheaters',
    });
    const res = jsonResponse();

    await middleware(req as never, res as never, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(read).toHaveBeenCalledWith({ url: 'https://example.com/theaters' });
    expect(res.json()).toMatchObject({ status: 'read' });
  });
});
