import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@agent-harness/ext-workflow-canvas': path.resolve(__dirname, '../workflow-canvas/src/index.ts'),
      'harness-core': path.resolve(__dirname, '../../../harness-core/src/index.ts'),
    },
  },
});
