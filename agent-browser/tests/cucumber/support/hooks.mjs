import { After, AfterAll, Before, BeforeAll, Status, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from '@playwright/test';
import {
  buildInferenceWorkerModuleStub,
  installRegistryMock,
  isCriticalAssetUrl,
  isCriticalConsoleError,
  isIgnoredLocalUrl,
  isLocalUrl,
} from './helpers.mjs';

let browser;

setDefaultTimeout(60_000);

BeforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

Before({ tags: '@product-contract' }, async function() {
  await this.attach('Skipped: media surfaces are documented as a product contract, but the current React prototype does not implement dedicated viewer or playback surfaces yet.', 'text/plain');
  return 'skipped';
});

Before({ tags: 'not @product-contract' }, async function() {
  this.context = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
  this.page = await this.context.newPage();
  this.runtimeErrors = [];
  this.currentWorkspace = 'Research';
  this.lastModelName = null;
  this.lastModelId = null;
  this.lastFilePath = null;
  this.lastTerminalSession = null;

  this.page.on('console', (message) => {
    if (message.type() === 'error' && isCriticalConsoleError(message.text())) {
      this.runtimeErrors.push(`console:${message.text()}`);
    }
  });
  this.page.on('pageerror', (error) => {
    this.runtimeErrors.push(`pageerror:${error.message}`);
  });
  this.page.on('requestfailed', (request) => {
    const url = request.url();
    if (isLocalUrl(url) && !isIgnoredLocalUrl(url) && isCriticalAssetUrl(url)) {
      this.runtimeErrors.push(`requestfailed:${request.method()} ${url} ${request.failure()?.errorText ?? 'unknown error'}`);
    }
  });
  this.page.on('response', (response) => {
    const url = response.url();
    if (isLocalUrl(url) && !isIgnoredLocalUrl(url) && isCriticalAssetUrl(url) && response.status() >= 400) {
      this.runtimeErrors.push(`response:${response.status()} ${url}`);
    }
  });

  await this.context.route(/browserInference\.worker\.ts\?worker/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: buildInferenceWorkerModuleStub(),
    });
  });
  await installRegistryMock(this.page);
});

After(async function({ result }) {
  try {
    if (result?.status === Status.FAILED && this.page) {
      const screenshot = await this.page.screenshot({ fullPage: true });
      await this.attach(screenshot, 'image/png');
    }

    if (this.runtimeErrors?.length) {
      throw new Error(`Unexpected runtime errors:\n${this.runtimeErrors.join('\n')}`);
    }
  } finally {
    if (this.context) {
      await this.context.close();
      this.context = null;
      this.page = null;
    }
  }
});

AfterAll(async () => {
  await browser?.close();
});