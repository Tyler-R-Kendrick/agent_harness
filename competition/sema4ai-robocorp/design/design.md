# Sema4.ai / Robocorp Design

## Look And Feel

- Documentation-led developer product with CLI commands, VS Code workflows, Python examples, and deployment guides.
- The Robocorp lineage is still visible in docs, package names, and Control Room concepts.
- Design is more engineer/toolchain focused than glossy enterprise suite marketing.

## Design Tokens To Track

```yaml
surface: documentation, VS Code extension, Control Room, Action Server
accent: developer automation branding
primary_control: Python action decorator and VS Code workflow
core_objects:
  - Python action
  - robot
  - action server
  - OpenAPI endpoint
  - Control Room workspace
  - vault secret
  - work item
  - visual inspector
information_density: high
trust_model: code-first automation with managed deployment controls
```

## Differentiators

- Action Server turns Python functions into OpenAPI-accessible AI actions using type hints and docstrings.
- VS Code extension supports create, run, debug, publish, vault secrets, work items, and browser/desktop UI element inspection.
- Control Room and RCC provide a mature automation deployment model for Python-first teams.

## What Is Good

- Developer ergonomics are strong for teams that prefer code over low-code canvas builders.
- The local Action Server path is a clean bridge between deterministic Python automation and LLM/agent callers.
- Browser and desktop inspection in the extension maps well to real UI automation work.

## Where It Breaks Down

- The Robocorp to Sema4.ai transition creates naming and documentation confusion.
- The product is more a toolchain than a polished browser-agent UX; non-developers may not know where to start.
- Buyers evaluating "AI agent" platforms may find the split between robots, actions, agents, and Control Room hard to parse.

## Screenshot References

- Build agents docs: https://sema4.ai/docs/build-agents
- Downloads/tooling page: https://sema4.ai/docs/automation/downloads
- Action Server docs: https://sema4.ai/docs/automation/action-server
- VS Code extension docs: https://sema4.ai/docs/automation/visual-studio-code
