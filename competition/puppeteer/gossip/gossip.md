# Puppeteer Gossip

## Positive Signals

- Puppeteer remains a default mental model for browser automation in JavaScript.
- Its docs are concise, versioned, and immediately runnable, which lowers adoption friction.
- MCP server examples built on Puppeteer keep it relevant in agent-tool ecosystems even when the library itself is not an agent product.

## Negative Signals

- Browser automation complaints often cluster around setup and flakiness: browser binary downloads, CI dependencies, sandbox flags, timing, selectors, and headless differences.
- Academic work on JavaScript flaky tests and web E2E waits reinforces that browser automation failures are often caused by concurrency, async waits, and UI timing.
- The archived reference Puppeteer MCP server warns that a local browser can access local files and internal IPs, which is exactly the safety boundary productized agent browsers must handle visibly.

## Bug And UX Complaints To Track

- CI failures when Chromium dependencies or sandbox configuration are wrong.
- Selector drift and timing flakes in dynamic single-page apps.
- Large screenshots or console logs overwhelming the caller.
- Unsafe launch options such as disabling web security or sandboxing.
- Lack of first-class run review unless another tool records traces.

## Sources

- https://pptr.dev/
- https://github.com/modelcontextprotocol/servers-archived/tree/main/src/puppeteer
- https://arxiv.org/abs/2207.01047
- https://arxiv.org/abs/2402.09745
