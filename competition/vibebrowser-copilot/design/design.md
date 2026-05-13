# VibeBrowser Co-Pilot Design

## Look And Feel

- Product pages use a dark technical SaaS style with bright blue/green accents, terminal-like command snippets, comparison tables, and capability counters.
- The product is visually framed as a Chrome-side co-pilot plus MCP/relay infrastructure, not a full replacement browser.
- Messaging repeats "real browser", "logged-in session", "local-first", "guardrails", "MCP", and "secrets vault" as trust cues.

## Design Tokens To Track

```yaml
surface: dark developer marketing
accent: cyan and green execution/status highlights
primary_control: browser side panel prompt and MCP tool calls
secondary_controls:
  - install extension
  - MCP setup tabs
  - local/remote relay mode
  - reusable skills
  - secrets vault
trust_controls:
  - local browser profile
  - human approvals
  - credential type-in without exposing secrets to the model
  - multi-agent relay visibility
information_density: high
```

## Differentiators

- Uses the user's existing logged-in browser rather than a separate headless or disposable browser by default.
- Presents browser control as a callable MCP surface for Claude Code, Codex, OpenCode, Gemini CLI, Copilot, and similar agents.
- Combines browser tools with Google Workspace tools, secrets, memory, reusable skills, and multi-agent coordination.

## What Is Good

- The MCP route makes the value legible to agent builders: browser control, snapshots, workspace actions, secrets, and coordination are named surfaces.
- The real-profile story removes a major setup pain for authenticated SaaS workflows.
- Secrets vault/type-in is a concrete answer to a common AI-browser trust objection.

## Where It Breaks Down

- The product message is crowded: co-pilot, MCP bridge, relay, skills, Google Workspace, secrets, remote mode, and self-modifying agents all compete for attention.
- Remote relay into a real logged-in browser creates a high-stakes security model that needs unusually clear consent, audit, revocation, and failure handling.
- A multi-agent shared browser session is powerful but can become confusing without strong locking, attribution, and conflict UX.

## Screenshot References

- Product page: https://www.vibebrowser.app/
- MCP page: https://www.vibebrowser.app/mcp
- Older waitlist/product page: https://www.vibebrowser.com/
