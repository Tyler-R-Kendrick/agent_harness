import { defineConfig } from '@playwright/test';

const host = process.env.AGENT_BROWSER_PLAYWRIGHT_HOST ?? '127.0.0.1';
const port = Number(process.env.AGENT_BROWSER_PLAYWRIGHT_PORT ?? '4173');
const baseURL = `http://${host}:${port}`;
const webServerCommand = process.env.AGENT_BROWSER_PLAYWRIGHT_PORT
  ? `node ../scripts/run-package-bin.mjs vite --host ${host} --port ${port} --strictPort`
  : 'npm run dev:cucumber';

const experimentalGpuArgs =
  process.env.AGENT_BROWSER_PLAYWRIGHT_GPU === '1'
    ? [
        '--enable-gpu',
        '--ignore-gpu-blocklist',
        '--enable-unsafe-webgpu',
        '--enable-features=Vulkan,WebGPU',
        '--use-vulkan=swiftshader',
        '--use-angle=vulkan',
      ]
    : [];

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    launchOptions: {
      args: experimentalGpuArgs,
    },
  },
  webServer: {
    command: webServerCommand,
    port,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
