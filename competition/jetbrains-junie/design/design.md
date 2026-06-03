# JetBrains Junie Design

## Look And Feel

- Junie inherits JetBrains IDE density: tool windows, settings panes, project-aware controls, model selection, semantic indexing, guideline paths, and explicit project scopes.
- The CLI adds a terminal-native interaction model with slash commands, plan mode, debug mode, review mode, session history, usage reporting, MCP setup, skills, subagents, and custom commands.
- The public Junie site is cleaner and more promotional than JetBrains help docs, with model badges, installation commands, pricing cards, and feature blocks for guidelines, skills, subagents, MCP, and ACP.
- Documentation is precise and procedural, matching JetBrains' traditional developer-tool voice.

## Design Tokens To Track

```yaml
surface: JetBrains IDE agent plus standalone CLI
accent: JetBrains developer-tool brand with practical documentation
primary_control: AI Chat Junie tool window or `junie` terminal session
core_objects:
  - project path
  - Guidelines path
  - .aiignore
  - semantic indexing
  - MCP server
  - plan mode
  - debug mode
  - review wizard
  - AI Credit
  - BYOK model profile
evidence_objects:
  - progress report
  - design document
  - diff review finding
  - debugger state
  - token usage report
information_density: high
```

## Differentiators

- Deep IDE integration is the design moat: Junie can use JetBrains project knowledge, language tooling, debugger integration, semantic indexing, and IDE settings.
- CLI mode broadens Junie beyond JetBrains IDE windows into terminals, CI, GitHub/GitLab workflows, and ACP-compatible clients.
- Plan mode creates a read-only design document before writing code, which is closer to a deliberate engineering workflow than a direct prompt-to-edit loop.
- MCP Installation Assistant reduces manual MCP setup by suggesting, configuring, and verifying servers.
- `/review` ties local review to the same backend used for automated code reviews, giving local and PR feedback a shared shape.

## What Is Good

- JetBrains makes scope visible: project path controls where Junie may edit, `.aiignore` restricts files, and guideline paths matter for monorepos.
- The CLI exposes usage with `/usage`, which is important for credit-governed agent work.
- Debug mode is a strong differentiator because it can inspect runtime state through a connected JetBrains IDE.
- ACP support positions Junie as an agent that can be reused by other editors rather than only a JetBrains UI.

## Where It Breaks Down

- The product spans AI Assistant, Junie IDE, Junie CLI, Claude Agent integration, Codex integration, BYOK, credits, top-ups, and IDE subscription bundles; users report confusion around what is included and what consumes credits.
- Official IDE docs note Junie does not work in WSL, which is a notable limitation for Windows developers using Linux-based toolchains.
- Credit units are easier to understand than raw tokens, but still create anxiety when Junie consumes a monthly quota quickly.
- The design is optimized for code and IDE state, not browser-session evidence, screenshots, visual regression artifacts, or authenticated web workflows.

## Screenshot References

- Junie IDE settings, MCP, and project scope docs: `https://www.jetbrains.com/help/ai-assistant/junie-agent.html`
- Junie public product and pricing cards: `https://junie.jetbrains.com/`
- CLI usage, plan/debug/review modes: `https://junie.jetbrains.com/docs/junie-cli-usage.html`
