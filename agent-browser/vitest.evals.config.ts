import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      logact: path.resolve(__dirname, '../lib/logact/src/index.ts'),
      'harness-core/ext/agent-skills': path.resolve(__dirname, '../harness-core/src/ext/agent-skills.ts'),
      'harness-core/ext/agents-md': path.resolve(__dirname, '../harness-core/src/ext/agents-md.ts'),
      'harness-core': path.resolve(__dirname, '../harness-core/src/index.ts'),
      'ralph-loop': path.resolve(__dirname, '../lib/ralph-loop/src/index.ts'),
      webmcp: path.resolve(__dirname, '../lib/webmcp/src/index.ts'),
      'agent-browser-mcp': path.resolve(__dirname, '../lib/agent-browser-mcp/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['evals/**/*.test.ts'],
    testTimeout: 300_000,
  },
});
