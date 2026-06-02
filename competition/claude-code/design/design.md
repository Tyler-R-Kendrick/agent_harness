# Claude Code Design

## Look And Feel

- Terminal-first, transcript-driven interface that feels close to a senior developer working inside the user's shell.
- The UI design is intentionally sparse: project files, tool calls, command output, permission prompts, and concise status updates are the main surface.
- Documentation and product copy emphasize the agentic loop: gather context, take action, verify, and let the user interrupt at any point.

## Design Tokens To Track

```yaml
surface: terminal, GitHub Actions, code review, docs, extension layer
accent: Anthropic orange/neutral documentation and CLI status styling
primary_control: natural-language terminal task
core_objects:
  - CLAUDE.md
  - MEMORY.md
  - tool call
  - permission prompt
  - subagent
  - skill
  - MCP server
  - hook
  - compacted conversation
information_density: high
trust_surfaces:
  - terminal transcript
  - permission gates
  - project instructions
  - usage warnings
  - hooks and policy scripts
```

## Differentiators

- Claude Code makes project conventions first-class through `CLAUDE.md` and memory.
- The extension system is unusually broad: skills, MCP, subagents, hooks, plugins, code intelligence, browser interaction, and agent teams.
- The CLI owns the complete developer loop: search files, edit code, run tests, inspect Git, and call external tools.
- Usage-management guidance is explicit, with `/clear`, `/compact`, and model-matching recommendations.

## What Is Good

- The terminal shape is powerful for developers because it works where the repository, scripts, and debugging commands already live.
- Permission prompts and hooks give teams concrete places to insert policy.
- Subagents and skills turn repeated work into reusable workflows instead of one-off prompts.
- MCP and browser interaction make Claude Code a host for adjacent tools rather than only a code generator.

## Where It Breaks Down

- The interface can become transcript-heavy; important browser or visual evidence may be buried in logs or summaries.
- Usage limits and compaction can interrupt deep work or change the user's confidence in long sessions.
- Powerful terminal access increases blast radius when users over-grant permissions or run broad commands.
- Browser interaction is an extension of the terminal agent, not a dedicated browser-work evidence surface.

## Screenshot References

- Claude Code documentation screenshots and architecture diagrams: `https://code.claude.com/docs/en/how-claude-code-works`
- Extension layer documentation: `https://code.claude.com/docs/en/features-overview`
