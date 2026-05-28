# OpenOwl Design

## Look And Feel

- Consumer-developer landing page with simple three-step setup, plain-language task examples, testimonials, and local privacy claims.
- The design is more approachable than infrastructure vendors: install, describe the task, watch it work.
- Pricing is intentionally lightweight, with free self-hosting and a low monthly hosted plan.

## Design Tokens To Track

```yaml
surface: local automation landing page
accent: simple MCP/developer utility
primary_control: get started free
core_objects:
  - project
  - screen
  - browser tab
  - desktop app
  - MCP-compatible assistant
  - tool call
information_density: low_to_medium
trust_signals:
  - open source
  - Apache 2.0
  - local screenshots
  - no telemetry
```

## Differentiators

- Works across desktop apps and browser tabs instead of limiting itself to browser automation.
- Built around MCP compatibility with Claude, Codex, Gemini, and other assistants.
- Emphasizes that screenshots, files, keystrokes, and screen content stay on the user's machine.

## What Is Good

- The value proposition is easy to understand for non-infra users.
- Local-first and open-source positioning directly addresses privacy anxiety around browser agents.
- Multi-app workflows are a real wedge against browser-only products.

## Where It Breaks Down

- Screen-level control can be brittle when UI layouts, fonts, dark mode, or custom canvas surfaces change.
- The page gives less detail on action approval, trace review, permissions, and failure recovery.
- Whole-desktop access increases the blast radius of mis-clicks or prompt injection.

## Screenshot References

- Homepage and pricing: `https://openowl.dev/`
- GitHub repository: `https://github.com/mihir-kanzariya/openowl`
