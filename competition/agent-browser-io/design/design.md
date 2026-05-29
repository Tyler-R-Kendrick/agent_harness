# Agent Browser Design

## Look And Feel

- Minimal documentation/product page centered on a single demo: an ASCII wireframe of Hacker News with numbered interactive elements.
- The visual design is deliberately text-first; the "screenshot" is the agent's view rather than the human's.
- Install, MCP, Vercel AI SDK, CLI, and tool list all fit on one compact page.

## Design Tokens To Track

```yaml
surface: minimal docs page and npm package
visual_anchor: ASCII wireframe
primary_control: numeric element references
core_objects:
  - browser backend
  - wireframe
  - ref id
  - MCP server
  - Vercel AI SDK tools
  - CLI
tools:
  - launch
  - navigate
  - getWireframe
  - click
  - type
  - fill
  - screenshot
information_density: high
trust_posture: code-first, not policy-first
```

## Differentiators

- It turns page state into compact ASCII wireframes, which makes the agent perception model tangible.
- Numeric refs make click targets easy to discuss and replay in logs.
- Vercel AI SDK integration positions browser control as a toolset inside custom agent apps, not only a standalone MCP server.

## What Is Good

- The product explains its core idea immediately through the wireframe.
- The API surface is small enough that agents can learn it quickly.
- SDK and MCP paths cover both app builders and desktop agent-client users.

## Where It Breaks Down

- Human visual review is secondary; the page emphasizes the agent's compact view more than rich replay.
- ASCII wireframes can lose nuance from layout, visual hierarchy, disabled states, and dynamic affordances.
- The current product surface does not show team workflow, approvals, identity, or long-running task recovery.

## Screenshot References

- ASCII wireframe demo and install snippets: `https://agent-browser.io/`
