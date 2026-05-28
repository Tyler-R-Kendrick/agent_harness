import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createConfiguredWebSearchBridge,
  createSearchApiMiddleware,
  WebSearchBridge,
} from './web-search-runtime';

type SearchBridgeLike = Pick<WebSearchBridge, 'search'>;

function writeError(res: ServerResponse, error: Error): void {
  res.statusCode = 500;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: error.message || 'Web search failed.' }));
}

export function createWebSearchApiHandler(searchBridge: SearchBridgeLike = createConfiguredWebSearchBridge()) {
  const middleware = createSearchApiMiddleware(searchBridge as WebSearchBridge);
  return async (req: IncomingMessage, res: ServerResponse) => {
    await middleware(req, res, (error?: Error) => {
      if (error) {
        writeError(res, error);
        return;
      }
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Not found.' }));
    });
  };
}

export default createWebSearchApiHandler();
