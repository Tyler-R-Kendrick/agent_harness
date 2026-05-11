# Design Studio Research

Captured: 2026-05-09

## Sources

- Design Studio launch: https://www.anthropic.com/news/design-studio-anthropic-labs
- Design Studio help guide: https://support.claude.com/en/articles/14604416-get-started-with-design-studio
- Design Studio design-system setup: https://support.claude.com/en/articles/14604397-set-up-your-design-system-in-design-studio
- Design Studio setup walkthrough screenshots: https://www.getmasset.com/resources/blog/building-a-landing-page-with-design-studio
- Design Studio repository: https://github.com/nexu-io/design-studio
- Design Studio releases: https://github.com/nexu-io/design-studio/releases
- Design Studio 0.6.0: https://github.com/nexu-io/design-studio/releases/tag/design-studio-v0.6.0
- Design Studio 0.5.0: https://github.com/nexu-io/design-studio/releases/tag/design-studio-v0.5.0

## Screenshot Inventory

- Design Studio entry view: https://github.com/nexu-io/design-studio/raw/main/docs/screenshots/01-entry-view.png
  - Flow: choose skill, design system, fidelity, and create.
- Design Studio discovery form: https://github.com/nexu-io/design-studio/raw/main/docs/screenshots/02-question-form.png
  - Flow: lock audience, brand, sources, and artifact intent before generation.
- Design Studio direction picker: https://github.com/nexu-io/design-studio/raw/main/docs/screenshots/03-direction-picker.png
  - Flow: pick one of five deterministic visual systems instead of freeform styling.
- Design Studio preview iframe: https://github.com/nexu-io/design-studio/raw/main/docs/screenshots/05-preview-iframe.png
  - Flow: inspect generated artifact, files, todos, tweak mode, and sharing/export actions.
- Design Studio export surface: https://support.claude.com/en/articles/14604416-get-started-with-design-studio
  - Flow: export ZIP, PDF, PPTX, Canva, standalone HTML, or agent handoff.
- Design Studio design-system setup: https://www.getmasset.com/images/blog/design-studio-setup-screen.png
  - Flow: provide org/company context, GitHub or uploaded code, Figma, fonts, logos, and brand assets.
- Design Studio token review: https://www.getmasset.com/images/blog/design_studio_looks_good.png
  - Flow: review generated design-system sections, resolve missing-font warnings, approve with Looks good, or send sections back with Needs work.
- Design Studio design-system section sample: uploaded runtime screenshot from 2026-05-10
  - Flow: show an aggregate UI kit composition first, then expand Type, Colors, and component standards with real specimens before approval.
- Design Studio published/default ready state: https://www.getmasset.com/images/blog/design_studio_new_design.png
  - Flow: publish the approved system and set it as default before creating new projects.

## Feature Matrix

| Product | Studio feature | Implemented surface |
| --- | --- | --- |
| Design Studio | Chat plus comments for targeted and structural design changes | Brief rail plus inspect controls and critique flow |
| Design Studio | Versioning and alternate directions | Deterministic direction selector with persistent state |
| Design Studio | Export/share formats | HTML export and agent handoff artifacts |
| Design Studio | Design feedback on accessibility, hierarchy, and usability | Five-panel critique gate |
| Design Studio | Design-system token review with approval or revision decisions | Token review lane with per-section approve and needs-work actions |
| Design Studio | Aggregate UI kit sample above section approvals | Approval composition sample that combines layout, type, palette, inspector, and command assets |
| Design Studio | Expanded type/color/component specimens before approval | Per-section visual sample beside every token or component standard |
| Design Studio | Published/default design system readiness | Publish/default controls that block publication until token sections are approved |
| Design Studio | Skill and design-system picker | Direction rail and DESIGN.md compiler |
| Design Studio | Discovery form | Structured project, audience, surface, source, asset, and notes fields |
| Design Studio | Five curated directions | Editorial, Modern Minimal, Tech Utility, Brutalist, Warm Soft |
| Design Studio | Sandboxed preview | Live preview plane with token ladder and inspect mode |
| Design Studio | Design file browser and direct export | Workspace artifact browser and direct export |
| Design Studio 0.6.0 | Research/search, top bar actions, direct PDF/export, external MCP | Research inventory, icon top bar, export artifacts, plugin tools |

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
- Generated companion files live in the workspace artifact at `//workspace/artifacts/design-studio/` so the design system, token-review queue, preview, critique, and handoff can be inspected independently.
- The file is the source of truth for the rest of Agent Browser; agents should read DESIGN.md before editing visual surfaces.
