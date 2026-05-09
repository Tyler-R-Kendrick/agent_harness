# Steel.dev Design

## Look And Feel

- Developer-first, terminal-forward landing page with prominent code snippets, big operational metrics, docs links, GitHub, Discord, and pricing.
- Docs are API-reference oriented with sections for sessions, quick actions, integrations, credentials, files, extensions, CAPTCHA, profiles, and self-hosting.
- The brand leans into a memorable category line: humans use Chrome, agents use Steel.

## Design Tokens To Track

```yaml
surface: open-source docs, hosted SaaS dashboard, GitHub repo, cookbook
accent: dark technical infrastructure with bright action CTAs
primary_control: create browser session or connect over CDP
core_objects:
  - session
  - profile
  - credential
  - file
  - extension
  - CAPTCHA
  - session viewer
  - clean page format
information_density: high
```

## Differentiators

- Open-source browser API with a hosted cloud option gives buyers an escape hatch from pure SaaS lock-in.
- Integrates with agent frameworks and browser automation tools including Browser Use, Playwright, Puppeteer, Selenium, OpenAI Computer Use, Claude Computer Use, and Gemini Computer Use.
- Emphasizes token reduction through cleaned page formats alongside classic browser-control features.

## What Is Good

- The local Docker/self-host route is a major trust and experimentation advantage.
- CDP and SDK compatibility mean teams can adopt Steel without rewriting every browser workflow.
- Session viewer, request logging, cookies, extensions, proxies, CAPTCHA, and profiles map directly to production pain.

## Where It Breaks Down

- Open-source plus cloud plus multiple integrations creates a wider support matrix than a focused app.
- Self-hosting browser infrastructure still pushes operational work back onto the buyer.
- Some public issue traffic points to reliability, local UI, session-connection, and performance rough edges.

## Screenshot References

- Landing/pricing/product claims: `https://steel.dev/`
- Docs index: `https://docs.steel.dev/`
- GitHub repository: `https://github.com/steel-dev/steel-browser`
