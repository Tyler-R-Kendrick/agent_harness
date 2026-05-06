# Naming And Scope

Use lowercase kebab-case for the folder name.

## Naming rules

- Prefer short role names such as `docs-reviewer` or `release-manager`.
- Derive the name from the role description when the user does not provide one.
- Preserve the chosen public identity unless the user explicitly asks to rename it.

## Scope rules

- Keep the new agent focused on one job.
- Avoid copying the repository root `AGENTS.md` into the new bundle.
- Reserve `.evals/` only when the user asks for evaluation coverage or the workflow clearly needs it.