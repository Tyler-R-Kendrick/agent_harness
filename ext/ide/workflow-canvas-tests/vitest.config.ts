import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowCanvasSource = path.resolve(__dirname, '../workflow-canvas/src').replaceAll('\\', '/');

export default defineConfig({
  resolve: {
    alias: {
      '@agent-harness/ext-workflow-canvas': path.resolve(__dirname, '../workflow-canvas/src/index.ts'),
      'harness-core': path.resolve(__dirname, '../../../harness-core/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    pool: 'forks',
    isolate: false,
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 60_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      allowExternal: true,
      include: [`${workflowCanvasSource}/**/*.ts`],
      exclude: [`${workflowCanvasSource}/**/*.test.ts`, `${workflowCanvasSource}/__tests__/**`],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
