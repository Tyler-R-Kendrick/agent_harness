# Bundle Shape

Start with the minimal bundle and add directories only when they remove repetition or carry meaningful bundled knowledge.

## Required shape

```text
.agents/skills/<skill-name>/
  SKILL.md
```

## Add-on directories

- `references/` for templates, schemas, or long-form recipes.
- `scripts/` for deterministic helpers.
- `assets/` for bundled files consumed by the skill output.

Do not add empty directories just because the pattern exists.