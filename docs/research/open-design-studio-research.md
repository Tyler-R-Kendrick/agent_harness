# OpenDesign DESIGN.md Studio Research

Captured: 2026-05-09

## Sources

- Claude Design launch: https://www.anthropic.com/news/claude-design-anthropic-labs
- Claude Design help guide: https://support.claude.com/en/articles/14604416-get-started-with-claude-design
- Claude Design design-system setup: https://support.claude.com/en/articles/14604397-set-up-your-design-system-in-claude-design
- Claude Design setup walkthrough screenshots: https://www.getmasset.com/resources/blog/building-a-landing-page-with-claude-design
- Open Design repository: https://github.com/nexu-io/open-design
- Open Design releases: https://github.com/nexu-io/open-design/releases
- Open Design 0.6.0: https://github.com/nexu-io/open-design/releases/tag/open-design-v0.6.0
- Open Design 0.5.0: https://github.com/nexu-io/open-design/releases/tag/open-design-v0.5.0

## Screenshot Inventory

- Open Design entry view: https://github.com/nexu-io/open-design/raw/main/docs/screenshots/01-entry-view.png
  - Flow: choose skill, design system, fidelity, and create.
- Open Design discovery form: https://github.com/nexu-io/open-design/raw/main/docs/screenshots/02-question-form.png
  - Flow: lock audience, brand, sources, and artifact intent before generation.
- Open Design direction picker: https://github.com/nexu-io/open-design/raw/main/docs/screenshots/03-direction-picker.png
  - Flow: pick one of five deterministic visual systems instead of freeform styling.
- Open Design preview iframe: https://github.com/nexu-io/open-design/raw/main/docs/screenshots/05-preview-iframe.png
  - Flow: inspect generated artifact, files, todos, tweak mode, and sharing/export actions.
- Claude Design export surface: https://support.claude.com/en/articles/14604416-get-started-with-claude-design
  - Flow: export ZIP, PDF, PPTX, Canva, standalone HTML, or Claude Code handoff.
- Claude Design design-system setup: https://www.getmasset.com/images/blog/claude-design-setup-screen.png
  - Flow: provide org/company context, GitHub or uploaded code, Figma, fonts, logos, and brand assets.
- Claude Design token review: https://www.getmasset.com/images/blog/claude_design_looks_good.png
  - Flow: review generated design-system sections, resolve missing-font warnings, approve with Looks good, or send sections back with Needs work.
- Claude Design design-system section sample: uploaded runtime screenshot from 2026-05-10
  - Flow: show an aggregate UI kit composition first, then expand Type, Colors, and component standards with real specimens before approval.
- Claude Design published/default ready state: https://www.getmasset.com/images/blog/claude_design_new_design.png
  - Flow: publish the approved system and set it as default before creating new projects.

## Feature Matrix

| Product | Studio feature | Implemented surface |
| --- | --- | --- |
| Claude Design | Chat plus comments for targeted and structural design changes | Brief rail plus inspect controls and critique flow |
| Claude Design | Versioning and alternate directions | Deterministic direction selector with persistent state |
| Claude Design | Export/share formats | HTML export and Claude Code handoff artifacts |
| Claude Design | Design feedback on accessibility, hierarchy, and usability | Five-panel critique gate |
| Claude Design | Design-system token review with approval or revision decisions | Token review lane with per-section approve and needs-work actions |
| Claude Design | Aggregate UI kit sample above section approvals | Approval composition sample that combines layout, type, palette, inspector, and command assets |
| Claude Design | Expanded type/color/component specimens before approval | Per-section visual sample beside every token or component standard |
| Claude Design | Published/default design system readiness | Publish/default controls that block publication until token sections are approved |
| Open Design | Skill and design-system picker | Direction rail and DESIGN.md compiler |
| Open Design | Discovery form | Structured project, audience, surface, source, asset, and notes fields |
| Open Design | Five curated directions | Editorial, Modern Minimal, Tech Utility, Brutalist, Warm Soft |
| Open Design | Sandboxed preview | Live preview plane with token ladder and inspect mode |
| Open Design | Design file browser and direct export | Generated workspace files pane |
| Open Design 0.6.0 | Research/search, top bar actions, direct PDF/export, external MCP | Research inventory, icon top bar, export artifacts, plugin tools |

## User Flows To Preserve

1. Brief capture: ask for project, audience, surface, code folder, assets, and notes before generation.
2. Direction selection: select a deterministic design direction that maps to palette, typography, spacing, radius, and interaction tone.
3. Token review: inspect type, color, spacing, border, component, and brand token sections.
4. Aggregate sample review: inspect a composed Agent Browser page sample that combines the token set before approving any individual section.
5. Section sample review: inspect a visual specimen for each approvable token or component standard.
6. Approval/revision: approve sections with Looks good semantics or request needs-work revisions with reviewer notes.
7. Publish/default: publish only after every token section is approved, then mark the system as workspace default.
8. Preview inspection: review the design in a live visual plane and tune density/radius before export.
9. DESIGN.md compilation: emit a durable DESIGN.md file plus research, token-review JSON, system JSON, preview HTML, handoff, and critique artifacts.
10. Critique: score accessibility, hierarchy, implementation readiness, craft, brand fit, and approval readiness.
11. Handoff: generate artifacts downstream agents can apply without reinterpreting the design.

## DESIGN.md Contract

- YAML frontmatter stores machine-readable tokens: colors, typography, spacing, radii, motion, shadows, themes, and CSS selectors.
- Token-review metadata records each proposed token section, current/proposed values, visual sample, revision number, approval state, reviewer note, aggregate composition, and publish/default state.
- Markdown body stores provenance, selected direction, core decisions, component recipes, states, accessibility rules, exports, and agent handoff notes.
- Generated companion files live under `design/open-design/` so the design system, token-review queue, preview, critique, and handoff can be inspected independently.
- The file is the source of truth for the rest of Agent Browser; agents should read DESIGN.md before editing visual surfaces.
