# Scrapybara Design

## Look And Feel

- Developer-infrastructure site with a playful animal mascot, dark/terminal-style code blocks, and direct SDK examples.
- Docs are object-oriented around instances, tools, browser actions, streams, auth, and the Act SDK.
- The product feels closer to a computer-use cloud than a browser app: Ubuntu, Browser, Windows, filesystem, bash, edit tools, and model loops are core objects.

## Design Tokens To Track

```yaml
surface: marketing site, docs, dashboard, interactive stream
accent: playful developer infra with code-first examples
primary_control: start_ubuntu, start_browser, act, computer actions
core_objects:
  - remote instance
  - BrowserInstance
  - Ubuntu instance
  - Windows desktop
  - ComputerTool
  - BashTool
  - EditTool
  - auth state
  - stream URL
  - CDP URL
information_density: high
trust_posture: cloud-hosted computer-use infrastructure
```

## Differentiators

- Provides remote desktops for computer-use models, not just a browser automation session.
- Browser instances expose CDP URLs, screenshots, interactive streams, auth save/load, and pause/resume.
- Act SDK wraps model, tools, prompt, structured output, and step loop into a unified agent interface.

## What Is Good

- The mental model is broader than web automation: an AI can use browser, code execution, environment variables, files, and desktop controls.
- Interactive streaming and pause/resume make live monitoring and handoff clearer than fully opaque background jobs.
- The SDK examples are concrete and map to OpenAI CUA and Claude Computer Use use cases.

## Where It Breaks Down

- Whole-computer infrastructure can be heavier than a focused browser-agent workspace.
- Cloud desktop execution raises cost, data-residency, and credential-routing questions.
- Browser-specific product UX, trace review, and regression artifacts are less prominent than instance/tool APIs.
- Kernel publishes a migration page claiming Scrapybara shut down its virtual desktop and browser service on October 15, 2025, which conflicts with currently accessible Scrapybara marketing/docs and should be treated as a continuity risk signal until verified directly with the vendor.

## Screenshot References

- Marketing hero and capability grid: `https://scrapybara.com/`
- Browser docs and action reference: `https://docs.scrapybara.com/browser`
