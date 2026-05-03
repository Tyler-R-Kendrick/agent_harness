import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { createCopilotApiMiddleware } from './server/copilotMiddleware';
import { createSearchApiMiddleware, createWebPageApiMiddleware } from './server/searchMiddleware';

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
    server.middlewares.use(createSearchApiMiddleware());
    server.middlewares.use(createWebPageApiMiddleware());
  },
  configurePreviewServer(server) {
    server.middlewares.use(createCopilotApiMiddleware());
    server.middlewares.use(createSearchApiMiddleware());
    server.middlewares.use(createWebPageApiMiddleware());
  },
};

function resolveInstalledFile(packageRelativePath: string): string {
  const candidates = [
    path.resolve(__dirname, 'node_modules', packageRelativePath),
    path.resolve(__dirname, '..', 'node_modules', packageRelativePath),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

export default defineConfig({
  plugins: [stubNodeZlib, copilotApiPlugin, react()],
  server: {
    allowedHosts: true,
  },
  resolve: {
    alias: [
      {
        find: 'onnxruntime-web/webgpu',
        replacement: resolveInstalledFile('onnxruntime-web/dist/ort.webgpu.js'),
      },
      {
        find: 'mermaid',
        replacement: resolveInstalledFile('mermaid/dist/mermaid.js'),
      },
      {
        find: 'inbrowser-use',
        replacement: path.resolve(__dirname, '../lib/inbrowser-use/src/index.ts'),
      },
      {
        find: 'logact',
        replacement: path.resolve(__dirname, '../lib/logact/src/index.ts'),
      },
      {
        find: 'harness-core/ext/agent-skills',
        replacement: path.resolve(__dirname, '../harness-core/src/ext/agent-skills.ts'),
      },
      {
        find: 'harness-core/ext/agents-md',
        replacement: path.resolve(__dirname, '../harness-core/src/ext/agents-md.ts'),
      },
      {
        find: 'harness-core',
        replacement: path.resolve(__dirname, '../harness-core/src/index.ts'),
      },
      {
        find: 'ralph-loop',
        replacement: path.resolve(__dirname, '../lib/ralph-loop/src/index.ts'),
      },
      {
        find: 'webmcp',
        replacement: path.resolve(__dirname, '../lib/webmcp/src/index.ts'),
      },
      {
        find: '@agent-harness/webmcp',
        replacement: path.resolve(__dirname, '../lib/webmcp/src/index.ts'),
      },
      {
        find: 'agent-browser-mcp',
        replacement: path.resolve(__dirname, '../lib/agent-browser-mcp/src/index.ts'),
      },
      ...(process.env.VITE_ALLOW_SANDBOX_SAME_ORIGIN?.trim().toLowerCase() === 'true'
        ? []
        : [
            {
              find: '@webcontainer/api',
              replacement: path.resolve(__dirname, 'src/sandbox/adapters/webcontainer-api.stub.ts'),
            },
          ]),
    ],
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    chunkSizeWarningLimit: 3200,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        toolAgentHarness: path.resolve(__dirname, 'tool-agent-harness.html'),
      },
      output: {
        manualChunks(id) {
          return id.includes('/src/features/designer/') || id.includes('\\src\\features\\designer\\')
            ? 'designer'
            : undefined;
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
});
