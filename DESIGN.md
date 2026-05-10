# Agent Browser Design System

Agent Browser uses a compact, Material-inspired IDE interface. Prefer quiet structure, row-based layouts, and semantic controls over decorative components.

## Principles

- Show the minimum information required for the current task.
- Keep one primary interaction per surface.
- Use tables, lists, and dividers for operational data.
- Avoid cards, badges, pills, and decorative containers unless the product requirement explicitly calls for them.
- Prefer icon-only buttons for compact tool actions. Every icon button must have `aria-label` and `title`.
- Use visible text for headings, labels, data, and form controls, not for repeated tool buttons.
- Keep touch targets at least 30px in dense desktop UI and 36px on narrow viewports.

## Layout

- Use the app shell variables: `--app-bg`, `--panel-bg`, `--panel-bg-elevated`, `--panel-border`, `--text-muted`, and `--accent`.
- Separate regions with 1px dividers instead of nested cards.
- Keep main render areas focused on the active workflow. Side panels should summarize and provide nearby controls only.
- Prefer CSS grid or flex layouts with `min-width: 0`; content must truncate, wrap, or scroll intentionally.

## Interaction

- Buttons use icons from the existing icon library.
- Destructive or merge-like actions must be disabled until valid, or require a clear approval state.
- Hover, active, and `focus-visible` states must be visible.
- Follow Web Interface Guidelines: semantic HTML, accessible labels, keyboard operability, explicit reduced-motion behavior when adding animation, and no `transition: all`.

## Typography & Content

- Use the existing system font stack.
- Use sentence case for data and short Title Case for primary headings.
- Use tabular numerals for metrics.
- Avoid explanatory feature copy inside tools. Labels should make the mode and next action obvious.
