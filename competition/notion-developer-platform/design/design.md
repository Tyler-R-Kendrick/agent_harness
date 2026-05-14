# Notion Developer Platform Design Notes

## Interface Traits

- Workspace-first operations model: agents, data views, and human collaborators share the same canvas.
- Database-centric control surface: operational state is represented in tables/views rather than standalone run dashboards.
- Progressive path from no-code usage to code-backed behavior through Workers and CLI tooling.

## UX Implications Vs Agent Browser

- Notion optimizes for collaborative operational planning and team-visible status inside a knowledge workspace.
- Agent Browser optimizes for direct browser/runtime control, execution fidelity, and reproducible task verification.
- The products may converge on "agent hub" messaging while diverging on where execution truth lives (workspace records vs browser/session traces).
