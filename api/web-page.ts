import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createWebPageApiMiddleware,
  WebPageBridge,
} from './web-page-runtime';

type WebPageBridgeLike = {
  read: (request: { url: string }) => Promise<unknown>;
};

function writeError(res: ServerResponse, error: Error): void {
  res.statusCode = 500;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: error.message || 'Web page read failed.' }));
}

export function createWebPageApiHandler(webPageBridge?: WebPageBridgeLike) {
  const middleware = createWebPageApiMiddleware((webPageBridge ?? new WebPageBridge()) as never);
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
