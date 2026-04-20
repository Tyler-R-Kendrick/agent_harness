---
name: create-agent
description: "Create a scoped agent folder with an AGENTS.md file under .agents/<agent-name>/. Use this whenever the user asks for a new agent, reusable agent instructions, a workspace-scoped AGENTS.md, or a named automation persona inside the current workspace. Prefer it even when the user only describes the role and not the file layout."
license: MIT
metadata:
  version: "1.1.0"
---

# Create Agent

Use this skill to create a named agent bundle under `.agents/<agent-name>/` without improvising the file shape.

## Steps

1. Resolve the role, normalize the folder name to lowercase kebab-case, and keep the role-specific scope narrow.
2. Use `scripts/scaffold-agent.ts` as the deterministic source of truth for the folder path and AGENTS skeleton.
3. Create `.agents/<agent-name>/AGENTS.md`, then tailor the generated scaffold to the user's actual purpose, goals, constraints, workflow, and deliverables.
4. Reserve `.agents/<agent-name>/.evals/` only when the user asks for eval coverage or the workflow clearly needs it.

## Rules

- Keep the generated file scoped to the new agent instead of copying the repository root `AGENTS.md` verbatim.
- Preserve the normalized folder name unless the user explicitly asks for a different public identity.
- If the user gives only a description, derive the kebab-case name and tell them which name you chose.

## References

- Read [references/agent-template.md](references/agent-template.md) when you need the full AGENTS structure and adaptation notes.
- Read [references/naming-and-scope.md](references/naming-and-scope.md) when deciding how narrow the agent should be and whether to reserve `.evals/`.

## Deterministic output

`scripts/scaffold-agent.ts` defines the canonical folder name, output path, and AGENTS scaffold. Use it whenever the task is mechanical enough that you would otherwise hand-write the same skeleton again.