import type { IncomingMessage, ServerResponse } from 'node:http';
import { createWebPageApiMiddleware, WebPageBridge } from '../agent-browser/server/searchMiddleware';

type WebPageBridgeLike = Pick<WebPageBridge, 'read'>;

function writeError(res: ServerResponse, error: Error): void {
  res.statusCode = 500;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: error.message || 'Web page read failed.' }));
}

export function createWebPageApiHandler(webPageBridge: WebPageBridgeLike = new WebPageBridge()) {
  const middleware = createWebPageApiMiddleware(webPageBridge as WebPageBridge);
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

export default createWebPageApiHandler();
