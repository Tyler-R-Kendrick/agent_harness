import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import path from 'node:path';
import { createCopilotApiMiddleware } from './server/copilotMiddleware';

// just-bash/browser imports gunzipSync from node:zlib for gzip/gunzip/zcat.
// Those commands are documented as unsupported in browsers. This plugin stubs
// the module so Vite doesn't fail the build with "externalized" errors.
const stubNodeZlib: Plugin = {
  name: 'stub-node-zlib',
  enforce: 'pre',
  resolveId(id) {
    if (id === 'node:zlib') return '\0stub-zlib';
    return null;
  },
  load(id) {
    if (id === '\0stub-zlib') {
      return `
        export function gunzipSync() { throw new Error('gunzipSync is not supported in the browser'); }
        export function gzipSync() { throw new Error('gzipSync is not supported in the browser'); }
        export const constants = {};
      `;
    }
    return null;
  },
};

const copilotApiPlugin: Plugin = {
  name: 'copilot-api',
  configureServer(server) {
    server.middlewares.use(createCopilotApiMiddleware());
  },
  configurePreviewServer(server) {
    server.middlewares.use(createCopilotApiMiddleware());
  },
};

export default defineConfig({
  plugins: [stubNodeZlib, copilotApiPlugin, react()],
  resolve: {
    alias: process.env.VITE_ALLOW_SANDBOX_SAME_ORIGIN?.trim().toLowerCase() === 'true'
      ? []
      : [
          {
            find: '@webcontainer/api',
            replacement: path.resolve(__dirname, 'src/sandbox/adapters/webcontainer-api.stub.ts'),
          },
        ],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2020',
    sourcemap: true,
  },
});
