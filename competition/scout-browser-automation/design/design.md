# Scout Design

## Look And Feel

- Scout presents as a polished protocol-infrastructure page: dark technical surface, code snippets, architecture diagram, feature cards, examples, docs, pricing, security, and changelog links.
- The central visual metaphor is a direct pipe from MCP tool calls to Scout MCP Server to Chrome extension to the user's Chrome browser.
- It emphasizes exact browser primitives: CDP sessions, accessibility snapshots, DOM-native extraction, network events, console output, dialogs, downloads, refs, and batch operations.
- The docs are very agent-readable, with tool names, parameter blocks, examples, guardrail constants, and recipes.

## Design Tokens Observed

```yaml
visual_language:
  mode: technical protocol platform
  architecture:
    - AI agent
    - MCP protocol
    - Scout MCP server
    - Chrome extension
    - user Chrome browser
  proof_points:
    - 70+ MCP tools
    - 12 tool categories
    - under 5 minute setup
    - 10 browser actions per batch
interaction_patterns:
  refs:
    session: "@s"
    cdp_session: "@x"
    tab: "@t"
    element: "@e"
    network: "@n"
    file: "@f"
  guardrails:
    - max agent steps
    - result truncation
    - snapshot filtering
```

## Differentiators

- The @ ref system is a strong UX primitive for agents because it avoids repeating brittle selectors, long WebSocket URLs, or large DOM payloads.
- The extension-first architecture is easy to understand: no remote browser, no proxy, no MITM, and the user's authenticated Chrome remains the substrate.
- Multi-agent coordination tools are unusually explicit for a browser automation product.
- Guardrails around max tool calls, result size, and snapshot filtering acknowledge cost and context-window failure modes directly.

## Where It Breaks Down

- The tool surface is large. 70+ tools across 12 categories can overwhelm users and agents unless routing docs are excellent.
- Payment/wallet tooling in the same extension settings as browser automation raises trust questions for conservative buyers.
- Scout needs an API key for the server even though the browser runs locally, which complicates the "no infrastructure" message.
- A polished protocol surface can still fail if extension permissions, CDP sessions, or tab assignment drift from what the user expects.

## Sources

- https://www.scout.i.ng/
- https://www.scout.i.ng/docs
