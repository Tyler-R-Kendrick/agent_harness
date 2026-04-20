---
name: create-agent-skill
description: "Create a reusable agent skill bundle under .agents/skills/<skill-name>/ that follows agentskills.io conventions. Use this whenever the user asks for a SKILL.md, reusable workflow skill, skill scaffold, or packaged agent capability inside the current workspace. Prefer it even when the user only describes the capability and not the folder structure."
license: MIT
metadata:
  version: "1.1.0"
---

# Create Agent Skill

Use this skill to create a workspace-local skill bundle under `.agents/skills/<skill-name>/` without inventing the layout ad hoc.

## Steps

1. Capture the intent, trigger conditions, expected outputs, and edge cases before writing files.
2. Normalize the skill name to lowercase kebab-case and use `scripts/scaffold-agent-skill.ts` as the deterministic source of truth for the initial bundle plan.
3. Create the canonical bundle with `SKILL.md`, then add `references/`, `scripts/`, or `assets/` only when they remove repetition or carry important bundled knowledge.
4. Keep the top-level `SKILL.md` focused on triggering and workflow, and move long templates or schemas into `references/`.

## Rules

- Keep the description explicit enough that the agent will trigger the skill when the domain appears.
- Use `.agents/skills/`, not the legacy `.agents/skill/` path.
- Add deterministic helpers when the output is mostly templated or mechanically reproducible.

## References

- Read [references/skill-template.md](references/skill-template.md) for the base SKILL structure and progressive-disclosure checklist.
- Read [references/bundle-shape.md](references/bundle-shape.md) when deciding whether the skill needs `references/`, `scripts/`, or `assets/`.

## Deterministic output

`scripts/scaffold-agent-skill.ts` defines the normalized folder name, default `SKILL.md`, and initial bundle layout. Use it when the task is mostly scaffolding and save your judgment for the domain-specific parts.