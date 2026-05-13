import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  outputDir: '../../../output/playwright/workflow-canvas-test-results',
  fullyParallel: true,
  reporter: [['list']],
  projects: [
    {
      name: 'workflow-canvas-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  use: {
    baseURL: 'http://127.0.0.1:4184',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4184 --strictPort',
    url: 'http://127.0.0.1:4184',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
