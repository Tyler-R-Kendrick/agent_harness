import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@agent-harness/ext-agent-skills': path.resolve(__dirname, '../ext/harness/agent-skills/src/index.ts'),
      '@agent-harness/ext-agents-md': path.resolve(__dirname, '../ext/harness/agents-md/src/index.ts'),
      '@agent-harness/ext-artifacts': path.resolve(__dirname, '../ext/ide/artifacts/src/index.ts'),
      '@agent-harness/ext-design-md': path.resolve(__dirname, '../ext/ide/design-md/src/index.ts'),
      '@agent-harness/ext-symphony': path.resolve(__dirname, '../ext/runtime/symphony/src/index.ts'),
      '@agent-harness/workgraph': path.resolve(__dirname, '../lib/workgraph/src/index.ts'),
      '@agent-harness/ext-workflow-canvas': path.resolve(__dirname, '../ext/ide/workflow-canvas/src/index.ts'),
      '@agent-harness/ext-local-model-connector': path.resolve(__dirname, '../ext/provider/local-model-connector/src/index.ts'),
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
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/App.integration.test.tsx'],
    testTimeout: 60_000,
  },
});
