# Browserbase + Stagehand Design

## Look And Feel

- Documentation-first developer product with Mintlify-style left navigation, code blocks, quickstarts, and dashboard links.
- Marketing language emphasizes production scale and infrastructure confidence rather than consumer browser delight.
- Stagehand examples present a clean code-first flow: initialize, navigate, `act`, `extract`, close.

## Design Tokens To Track

```yaml
surface: developer documentation and SaaS dashboard
accent: Browserbase blue/technical infrastructure branding
primary_control: API key plus SDK quickstart
core_objects:
  - browser session
  - search/fetch
  - identity
  - model gateway
  - functions
  - session replay/logs
stagehand_primitives:
  - act
  - extract
  - observe
  - Playwright interop
information_density: high
```

## Differentiators

- Managed browser fleet and identity/proxy/CAPTCHA story.
- Stagehand explicitly avoids "one giant prompt" by mixing granular AI steps with Playwright or traditional automation.
- Observability is a first-class design promise: logs, live view, recordings, and debugging.

## What Is Good

- Developer quickstarts are concrete and low-friction.
- Granular AI primitives map to testable automation better than black-box agents.
- Infrastructure story is strong for production workloads that cannot run inside a local browser app.

## Where It Breaks Down

- The product is less useful for end users who need a visible, daily browser workspace.
- Managed cloud infra creates cost and data-routing questions.
- The distinction between Browserbase platform and Stagehand SDK can confuse new users.

## Screenshot References

- Browserbase docs/dashboard links: `https://docs.browserbase.com/welcome/what-is-browserbase`
- Stagehand quickstart/code examples: `https://docs.browserbase.com/introduction/stagehand`

