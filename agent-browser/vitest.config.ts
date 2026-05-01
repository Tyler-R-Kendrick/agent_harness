import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      logact: path.resolve(__dirname, '../lib/logact/src/index.ts'),
      'harness-core': path.resolve(__dirname, '../lib/harness-core/src/index.ts'),
      'ralph-loop': path.resolve(__dirname, '../lib/ralph-loop/src/index.ts'),
      webmcp: path.resolve(__dirname, '../lib/webmcp/src/index.ts'),
      'agent-browser-mcp': path.resolve(__dirname, '../lib/agent-browser-mcp/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    exclude: ['tests/**', 'node_modules/**', 'dist/**', 'scripts/**/*.test.*'],
    testTimeout: 60_000,
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
