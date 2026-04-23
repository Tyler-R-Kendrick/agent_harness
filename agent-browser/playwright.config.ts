import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    screenshot: 'only-on-failure',
    launchOptions: {
      args: [
        '--enable-gpu',
        '--ignore-gpu-blocklist',
        '--enable-unsafe-webgpu',
        '--enable-features=Vulkan,WebGPU',
        '--use-vulkan=swiftshader',
        '--use-angle=vulkan',
      ],
    },
  },
  webServer: {
    command: 'npm run dev:cucumber',
    port: 4173,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
