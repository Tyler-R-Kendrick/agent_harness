# Browserless Gossip

## Positive Signals

- Browserless has a mature public docs surface and a large GitHub issue history, which signals real production usage rather than a thin demo.
- The category thesis is validated by recurring platform promises around memory leaks, version updates, missing libraries, downloads, sessions, scaling, and load balancing.
- BrowserQL's anti-detection positioning is unusually direct, which is attractive to scraping-heavy buyers that already know vanilla Playwright gets blocked.

## Negative Signals

- Public GitHub issues include reports around black screens in local docs, installation problems, CDP protocol errors, Docker timeouts, ARM architecture issues, user-data persistence, debugger frontend routing, and unauthorized connections crashing Docker.
- CAPTCHA and stealth claims create high expectations; when edge cases fail, the perceived product failure is more severe than a normal Playwright bug.
- Some operators still need container, proxy, browser-version, and session tuning, so Browserless reduces but does not eliminate operational complexity.

## Bug And UX Risk Themes

- Remote browser state is fragile when session reuse, user data dirs, reconnects, and browser versions drift.
- Debugging can become split across Browserless dashboard artifacts, local client logs, and the target site's anti-bot behavior.
- Pricing surprises can appear when long sessions, reconnects, residential proxy bandwidth, and CAPTCHA solves stack together.

## Sources

- https://www.browserless.io/
- https://www.browserless.io/feature/browserql
- https://docs.browserless.io/
- https://docs.browserless.io/browserql/start
- https://docs.browserless.io/baas/start
- https://docs.browserless.io/browserql/session-management/session-replay
- https://www.browserless.io/pricing
- https://github.com/browserless/browserless/issues
