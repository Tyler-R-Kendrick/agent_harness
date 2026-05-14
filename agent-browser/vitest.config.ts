import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const alias = {
  '@agent-harness/ext-agent-skills': path.resolve(__dirname, '../ext/harness/agent-skills/src/index.ts'),
  '@agent-harness/ext-agents-md': path.resolve(__dirname, '../ext/harness/agents-md/src/index.ts'),
  '@agent-harness/ext-artifacts': path.resolve(__dirname, '../ext/ide/artifacts/src/index.ts'),
  '@agent-harness/ext-design-md': path.resolve(__dirname, '../ext/ide/design-md/src/index.ts'),
  '@agent-harness/ext-design-studio': path.resolve(__dirname, '../ext/ide/design-studio/src/index.ts'),
  '@agent-harness/workgraph': path.resolve(__dirname, '../lib/workgraph/src/index.ts'),
  '@agent-harness/ext-workflow-canvas': path.resolve(__dirname, '../ext/ide/workflow-canvas/src/index.ts'),
  '@agent-harness/ext-local-model-connector': path.resolve(__dirname, '../ext/provider/local-model-connector/src/index.ts'),
  '@agent-harness/agent-sandbox': path.resolve(__dirname, '../lib/agent-sandbox/src/index.ts'),
  logact: path.resolve(__dirname, '../lib/logact/src/index.ts'),
  'harness-core': path.resolve(__dirname, '../harness-core/src/index.ts'),
  'ralph-loop': path.resolve(__dirname, '../lib/ralph-loop/src/index.ts'),
  webmcp: path.resolve(__dirname, '../lib/webmcp/src/index.ts'),
  'agent-browser-mcp': path.resolve(__dirname, '../lib/agent-browser-mcp/src/index.ts'),
};

const baseExclude = [
  'tests/**',
  'node_modules/**',
  'dist/**',
  'evals/**',
  'scripts/**/*.test.*',
  'src/App.integration.test.tsx',
];

const domTestFiles = [
  'src/features/flags.test.ts',
  'src/features/tours/driverTour.test.ts',
  'src/sandbox/iframe-session.test.ts',
  'src/sandbox/runner.test.ts',
  'src/services/chatMessageCopy.test.ts',
  'src/services/chatMessageCopyControls.test.ts',
  'src/services/sessionState.test.ts',
  'src/services/workspaceFiles.test.ts',
];

let reactPlugin: Awaited<ReturnType<typeof import('@vitejs/plugin-react')>>['default'] | null = null;
try {
  const plugin = await import('@vitejs/plugin-react');
  reactPlugin = plugin.default;
} catch {
  reactPlugin = null;
}

export default defineConfig({
  plugins: reactPlugin ? [reactPlugin()] : [],
  resolve: {
    alias,
  },
  test: {
    testTimeout: 60_000,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          globals: true,
          environment: 'node',
          include: [
            'server/**/*.test.ts',
            'src/**/*.test.ts',
          ],
          exclude: [
            ...baseExclude,
            ...domTestFiles,
          ],
          testTimeout: 60_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['src/test-setup.ts'],
          include: [
            'src/**/*.test.tsx',
            ...domTestFiles,
          ],
          exclude: baseExclude,
          testTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test-fixtures/**',
        'src/test-setup.ts',
        'src/main.tsx',
        'src/**/*.d.ts',
      ],
    },
  },
});
