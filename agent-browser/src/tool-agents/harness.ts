/**
 * tool-agents/harness.ts
 *
 * Browser entry point for the InBrowserUse tool-agent Playwright harness.
 * Exposes window.__inBrowserUse so Playwright tests can drive the current page.
 */

import { createInAppPage } from 'inbrowser-use';

Object.assign(window, {
  __inBrowserUse: createInAppPage(),
});
