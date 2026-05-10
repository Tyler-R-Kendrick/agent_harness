# Playwright MCP Design

## Look And Feel

- Documentation-first, OSS infrastructure design inherited from Playwright: clean docs, code blocks, configuration snippets, and API/tool reference.
- The product UI is mostly invisible; the primary experience is the MCP client, terminal install path, and structured accessibility snapshots returned to the agent.
- The mental model is deterministic browser tooling rather than an end-user app: snapshots, refs, tools, profiles, transports, and browser contexts.

## Design Tokens To Track

```yaml
surface: docs, GitHub README, npm CLI, MCP client tool schema
accent: Playwright developer documentation style
primary_control: browser_snapshot followed by ref-based browser actions
core_objects:
  - accessibility snapshot
  - element ref
  - persistent profile
  - isolated context
  - browser tab
  - MCP transport
  - storage state
information_density: very_high
```

## Differentiators

- Accessibility snapshot design avoids vision-only browsing and makes interactions inspectable as structured text.
- Element refs reduce selector guessing and allow agents to click/type/check by stable current-page references.
- The official Playwright brand gives immediate trust, ecosystem familiarity, and compatibility with existing browser automation knowledge.

## What Is Good

- Setup is simple for MCP-capable clients: `npx @playwright/mcp@latest` is enough for many workflows.
- Works across browsers and supports headed/headless use, isolated sessions, persistent profiles, storage state, screenshots, PDFs, and network-related tooling.
- Microsoft Learn material positions MCP as a practical way for assistants to inspect real DOM state and generate Playwright tests, especially where app-specific selectors are hard to infer.

## Where It Breaks Down

- Accessibility snapshots are not the same as a user's viewport; off-screen elements can appear actionable and lead agents to invalid actions or bad generated tests.
- Persistent profile and browser locking errors can break first-run or multi-client workflows.
- The lack of a dedicated product UI means trace review, approvals, replay, policy, and workspace state are left to the host assistant or surrounding toolchain.

## Screenshot References

- Product docs: `https://playwright.dev/mcp/introduction`
- GitHub README: `https://github.com/microsoft/playwright-mcp`
- Power Platform usage guide: `https://learn.microsoft.com/en-us/power-platform/developer/playwright-samples/ai-mcp`
