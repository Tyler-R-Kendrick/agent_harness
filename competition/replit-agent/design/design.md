# Replit Agent Design

## Look And Feel

- Friendly prompt-to-app workspace built around chat, project editor, live preview, task board, and visual Canvas.
- The design intentionally lowers coding vocabulary: users describe apps, choose output types, approve plans, and publish.
- Canvas makes design exploration spatial, with frames for apps, mockups, mobile/tablet/desktop variants, screenshots, sticky notes, drawings, and flow arrows.

## Design Tokens To Track

```yaml
surface: browser workspace, chat, project editor, task board, Canvas, preview, deployment
accent: approachable builder workspace
primary_control: describe what to build
core_objects:
  - project
  - artifact
  - task
  - checkpoint
  - design frame
  - published app
  - credit
information_density: medium
```

## Differentiators

- The app-building path is complete: prompt, plan, code, preview, auth, database, deploy, and iterate.
- Task system shows Drafts, Active, Ready, and Done so agent work feels like a small Kanban board.
- Canvas competes directly with visual app builders by making design variants and user flows first-class.

## What Is Good

- Beginner-friendly language expands the market beyond professional developers.
- Plan mode and task review give users a chance to correct the agent before code changes land.
- Live previews, checkpoints, and rollbacks make experimentation less scary.

## Where It Breaks Down

- Effort-based pricing turns the friendly UI into a cost-management surface for power users.
- Canvas and task boards can hide implementation quality unless test and diff review are equally visible.
- Replit-branded defaults such as Replit Auth are fast, but can constrain teams that need their own product identity or infrastructure.

## Screenshot References

- Agent flow: `https://docs.replit.com/core-concepts/agent`
- Task board: `https://docs.replit.com/core-concepts/agent/task-system`
- Canvas: `https://docs.replit.com/replitai/canvas`
