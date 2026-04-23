import { chromium } from 'playwright';
import { spawn } from 'child_process';
const xvfb = spawn('Xvfb', [':99', '-screen', '0', '1280x800x24'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  env: { ...process.env, DISPLAY: ':99' },
  args: [
    '--enable-features=Vulkan,UseSkiaRenderer,WebGPU,WebGPUService',
    '--enable-unsafe-webgpu',
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--no-sandbox',
  ],
});
const page = await browser.newPage();
page.on('console', (m) => console.error('[console]', m.type(), m.text()));
await page.goto('chrome://gpu');
await page.waitForTimeout(2000);
const text = await page.locator('body').innerText();
console.log(text.slice(0, 3000));
await browser.close();
xvfb.kill();
