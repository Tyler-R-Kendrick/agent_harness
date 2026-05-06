---
name: memory
description: Use when recalling, storing, or updating durable workspace memory through .memory markdown files.
---

# Memory

Use this skill whenever the user asks you to remember something, rely on remembered context, update preferences, or summarize durable project facts.

## Workflow

1. Inspect the workspace memory files before relying on prior context:
   - `.memory/MEMORY.md`
   - `.memory/user.memory.md`
   - `.memory/project.memory.md`
   - `.memory/workspace.memory.md`
   - `.memory/session.memory.md`
2. Treat each markdown list item as one memory factoid.
3. Prefer the narrowest relevant scope:
   - `user` for stable user preferences.
   - `project` for durable project architecture and decisions.
   - `workspace` for checkout-specific paths, tooling, and environment facts.
   - `session` for short-lived context from the active browser session.
   - `MEMORY.md` for facts that do not fit a narrower scope.
4. Add new memories as concise markdown list items. Do not store secrets, credentials, raw logs, or noisy transient details.
5. When using memory in an answer, mention if the memory may be stale or incomplete.

## Output

When memory is changed, summarize the scope and the exact fact stored.
