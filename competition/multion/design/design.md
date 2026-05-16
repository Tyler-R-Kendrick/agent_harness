# MultiOn Design

## Look And Feel

- MultiOn is documentation-led and API-first: the main product surface for builders is sessions, browse calls, screenshots, and step responses.
- The design exposes the agent lifecycle explicitly: create, browse, step, ask user, done, screenshot, close, and expire.
- Local mode keeps a server-hosted agent while routing actions through a Chrome extension, preserving the developer API while using a real local browser.

## Design Tokens To Track

```yaml
surface: API docs, playground, SDK examples, Chrome extension
accent: motor cortex for AI
primary_control: create or browse an agent session
core_objects:
  - session
  - command
  - step
  - screenshot
  - local mode
  - proxy
  - status
  - agent id
information_density: high
```

## Differentiators

- The `browse` API abstracts a complete web task behind a URL and natural-language command.
- Manual session stepping exposes a recoverable loop for workflows that need human input or plan refinement.
- Remote sessions are isolated by default, while local mode supports logged-in browser workflows through an extension.
- Native proxy support is explicit, which matters for bot protection and IP-sensitive web tasks.

## What Is Good

- Developers can choose between automatic browsing and stepwise control.
- Session screenshots and statuses create a better debugging surface than a black-box task result.
- Fast and standard modes make latency/cost tradeoffs part of the public API surface.

## Where It Breaks Down

- Sessions expire after inactivity, so long-running or paused workflows need orchestration above the API.
- Local mode still depends on extension health and the user's installed Chrome state.
- As with other browser agents, reliability depends on page state, authentication, bot protection, and when the agent decides to ask for help.

## Screenshot References

- Session lifecycle diagram: `https://docs.multion.ai/learn/sessions`
- API playground entry point: `https://docs.multion.ai/`
