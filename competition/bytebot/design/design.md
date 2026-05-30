# Bytebot Design

## Look And Feel

- Product site uses a high-contrast developer-startup style: large claims, repeated desktop screenshots, product capability sections, and deployment-oriented calls to action.
- The screenshots emphasize a visible Linux desktop rather than an abstract agent trace, making the product feel like a remote computer that happens to be AI-operated.
- Documentation is task-first: quickstart, Docker compose, Railway deployment, service URLs, and concrete example prompts.

## Design Tokens To Track

```yaml
surface: web app plus remote desktop
visual_anchor: live virtual desktop screenshots
primary_control: natural language task input
core_objects:
  - task
  - virtual desktop
  - browser
  - file system
  - password manager
  - terminal
  - takeover mode
  - action history
evidence_model:
  - screenshots before and after actions
  - logs
  - conversation history
  - direct desktop view
information_density: medium
trust_posture: self-hosted and inspectable, but broad computer authority
```

## Differentiators

- It frames the computer, not the browser tab, as the atomic automation surface.
- Manual takeover is part of the product story, so recovery is not only a failed-agent state.
- The documentation exposes REST APIs, MCP, and direct desktop APIs, which makes the visible UI and programmatic surface feel connected.

## What Is Good

- Strong mental model: a complete computer is easy to understand for multi-app workflows.
- Screenshots-before-and-after evidence maps well to business review and debugging.
- Self-hosted deployment helps buyers who cannot send browser sessions to a managed browser cloud.

## Where It Breaks Down

- The desktop metaphor is heavier than a focused browser-agent workspace for web-only tasks.
- A complete Linux environment widens the permission surface: files, apps, credentials, browser state, and shell actions all need policy boundaries.
- Docker/Kubernetes/Railway setup is approachable for engineers but can be too operational for end users who just want local browser help.

## Screenshot References

- Product screenshots and action log examples: `https://www.bytebot.ai/`
- Quickstart UI and service map: `https://docs.bytebot.ai/quickstart`
