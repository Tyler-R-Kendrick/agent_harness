# Repository notes

- Bundled skills live canonically under `skills/<skill-name>/`.
- `.agents/skills/<skill-name>` and `.claude/skills/<skill-name>` must be symlinks to `../../skills/<skill-name>`.
- When adding or updating a bundled skill, make changes in `skills/` and keep both compatibility symlinks in sync.
- Do not duplicate or hand-edit copied skill trees under `.agents/skills/` or `.claude/skills/`; use the symlinks instead.
