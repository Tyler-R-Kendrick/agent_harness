import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      logact: path.resolve(__dirname, '../lib/logact/src/index.ts'),
      webmcp: path.resolve(__dirname, '../lib/webmcp/src/index.ts'),
      'agent-browser-mcp': path.resolve(__dirname, '../lib/agent-browser-mcp/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    exclude: ['tests/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['src/test-setup.ts', '**/*.d.ts'],
    },
  },
});
