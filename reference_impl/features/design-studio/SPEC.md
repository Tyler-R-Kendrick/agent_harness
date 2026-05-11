# Feature Spec: Design Studio for Agent Browser

Status: Implemented v2

Purpose: Define and verify the Agent Browser Designer feature: a Design Studio-inspired workspace for browser-native design systems, design files, previews, comments, token-driven styling, share/export records, sketches, and DESIGN.md-powered theme application.

## 1. Problem Statement

Agent Browser already has editable workspace files and a `DESIGN.md` extension, but it does not yet provide a first-class design workspace. Users who want Claude-Design-like work must manually paste requirements into chat, manually manage style guidance, and manually wire CSS variables into app or widget surfaces.

This feature solves five problems:

- It turns a workspace `DESIGN.md` into a concrete design-system source, not just prose guidance.
- It provides Claude-Design-like surfaces for setup, generation, review, design files, sketches, sharing, and exports.
- It lets users swap token sets across widgets and the Agent Browser shell without hand-editing every CSS rule.
- It keeps design-system documents, generated previews, and handoff bundles inside the existing workspace file model.
- It makes design-system application inspectable, reversible, and testable.

## 2. Source Evidence and Visual Requirements

### 2.1 Public Product Sources

- Anthropic describes Design Studio as a research-preview Anthropic Labs product for designs, prototypes, slides, one-pagers, and more, powered by Claude Opus 4.7 and available on Pro, Max, Team, and Enterprise plans.
- Anthropic's launch post says the core loop is: describe the desired artifact, receive a first version, refine through conversation, inline comments, direct edits, or custom sliders, then export to Canva/PDF/PPTX or hand off to an agent.
- Claude Help Center describes the primary UI as a left chat interface and right canvas, with project context from screenshots, images, assets, codebases, and design files.
- Claude Help Center says design-system setup can ingest codebases, prototypes, screenshots, existing design files, slide decks, documents, logos, color palettes, and typography specimens; Claude then generates colors, typography, components, and layout patterns.
- Claude Help Center documents export options: `.zip`, PDF, PPTX, Canva, and standalone HTML.
- Public walkthroughs and user reports emphasize organization-published design systems, default design systems, custom tweak controls, known preview limitations, and a handoff bundle for agents.

### 2.2 User-Supplied Screenshot Requirements

The uploaded screenshots are normative for the Agent Browser recreation.

Required shell anatomy:

- A narrow left chat rail with `Chat` and `Comments` tabs, a small `+` action, message cards, tool-progress cards, and a bottom composer.
- A wide right workspace with top tabs for `Design System`, `Design Files`, and open sketch files.
- A compact top-right `Share` button and optional avatar/control cluster.
- A centered empty/generation canvas that can show `Creating your design system...` and a progress line.
- A bottom-right thumbnail preview during generation and review.

Required Design Studio home anatomy:

- Product identity: `Design Studio` by Anthropic Labs with a `Research Preview` badge.
- Primary tabs: `Designs`, `Examples`, `Design systems`.
- Left creation card with `Prototype`, `Slide deck`, `From template`, and `Other`.
- Project name input, `Wireframe` and `High fidelity` selectors, and a primary `Create` button.
- CTA card: `Set up design system`.
- Design Systems page with `Create new design system`, published/default behavior, empty template state, and privacy copy.

Required setup anatomy:

- Back button, centered brand spinner, and `Continue to generation` button.
- Heading `Set up your design system`.
- Company name/blurb field.
- Upload/import table with GitHub repo link, local code folder, `.fig` file, fonts/logos/assets, and optional notes.
- Local parsing note for `.fig` and large-codebase guidance.

Required generation/review anatomy:

- Generation state shows chat-side tool cards for reading, searching, viewing image metadata, and setting project title.
- Review state shows `Review draft design system`, published/default toggles, missing-font warning, component cards, `Looks good`, `Needs work...`, feedback text area, submit/cancel controls, and a visual preview.
- Chat-side caveats must preserve source limitations, sampled colors, font substitutions, product-surface assumptions, and prompts for feedback.

Required design-file anatomy:

- `Design Files` tab lists folders such as `agent-browser`, `assets`, `fonts`, `preview`, and `ui_kits`.
- It lists stylesheet and document files such as `colors_and_type.css`, `SKILL.md`, and `README.md`.
- Bottom drop zone accepts images, docs, references, Figma links, or folders.
- File preview pane shows an empty `Select a file to preview` state when nothing is selected.

Required sketch anatomy:

- Dotted infinite-canvas background.
- Floating centered toolbar with select, pan, pen, text, shape, arrow, component/library, and save controls.
- Share menu with access mode, copy link, file type, duplicate project/template, download zip, export PDF/PPTX, Canva, standalone HTML, and handoff to code.

Required examples anatomy:

- Examples tab can show a large generated artifact, prompt sidebar, and `Use this prompt` button.
- Controls can include tweak groups such as shell style, key shape, layout, display, font, size, alignment, and toggles.

## 3. Goals

- Provide a Symphony-style, implementation-neutral contract for Design Studio in Agent Browser.
- Use `DESIGN.md` as the canonical design-system document.
- Let one design system define multiple token packs and style targets.
- Support runtime switching between token packs for widgets and the full Agent Browser shell.
- Preserve generated design artifacts as workspace files.
- Keep v1 deterministic: token parsing, CSS generation, and local UI state must work without an LLM.

## 4. Non-Goals

- Pixel-perfect clone of Anthropic's private implementation details.
- Native Figma editing or import fidelity beyond uploaded/exported assets in v1.
- Multiplayer editing.
- Real Canva API export.
- Production-quality vector drawing engine in v1.
- LLM-generated code execution as part of the design-system review loop.

External-service parity is represented by deterministic local artifacts in v2. For example, `Send to Canva`, PDF, PPTX, zip, standalone HTML, and agent handoff actions create workspace export records and files, but they do not call third-party APIs.

## 5. File Contracts

### 5.1 `DESIGN.md`

`DESIGN.md` is a Markdown file with optional YAML front matter. It is the canonical design-system document for a workspace.

Parsing rules:

- If the file starts with `---`, parse until the next `---` as YAML front matter.
- Remaining Markdown is the design rationale, brand notes, exceptions, and component guidance.
- Unknown front-matter keys MUST be preserved by file editors and ignored by parsers that do not understand them.
- Invalid scalar values SHOULD be ignored with diagnostics, not crash the UI.

Supported v1 front-matter keys:

- `name`: display name.
- `description`: short system summary.
- `colors`: named color tokens.
- `typography`: named text-style tokens with `fontFamily`, `fontSize`, `fontWeight`, and `lineHeight`.
- `rounded`: radius tokens.
- `spacing`: spacing tokens.
- `shadows`: shadow tokens.
- `motion`: duration/easing tokens.
- `themes`: named overrides for any token group.
- `styles`: target mappings for shell and widget CSS variables.
- `components`: component variant guidance.

Example:

```md
---
name: Agent Browser Design System
colors:
  canvas: "#1e1e1e"
  surface: "#181818"
  surfaceRaised: "#252526"
  text: "#d4d4d4"
  muted: "#7d8590"
  accent: "#0e639c"
  accentStrong: "#1177bb"
themes:
  claude-light:
    colors:
      canvas: "#f7f4ef"
      surface: "#ffffff"
      text: "#151515"
      accent: "#d97757"
styles:
  agentBrowser:
    app-bg: colors.canvas
    panel-bg: colors.surface
    panel-bg-elevated: colors.surfaceRaised
    text-soft: colors.muted
    accent: colors.accent
    accent-strong: colors.accentStrong
  widgets:
    button-primary:
      background: colors.accent
      color: colors.surface
rounded:
  sm: 4px
  md: 6px
spacing:
  sm: 8px
  md: 12px
typography:
  ui:
    fontFamily: Segoe UI
    fontSize: 12px
---

## Overview

Design rationale and exceptions live here.
```

### 5.2 Workspace File Layout

Design Studio projects SHOULD use this workspace layout:

```text
DESIGN.md
design/
  manifest.json
  colors_and_type.css
  README.md
  assets/
  fonts/
  preview/
  sketches/
  ui_kits/
```

`design/manifest.json` records generated artifacts, design-system status, published/default flags, source material, review state, and export metadata.

### 5.3 Generated CSS

Generated CSS MUST be deterministic and wrapped in managed markers:

```css
/* design.md:start */
:root {
  --design-color-canvas: #1e1e1e;
  --app-bg: var(--design-color-canvas);
}
/* design.md:end */
```

The token generator MUST support both:

- Generic token variables: `--design-color-*`, `--design-radius-*`, `--design-space-*`, `--design-font-family-*`.
- Target variables: `--app-bg`, `--panel-bg`, `--accent`, widget-specific variables, and scoped theme variables.

### 5.4 Token Pack Addressing

A token pack is addressed by `{ designPath, themeId, targetId }`.

- `themeId = default` uses root tokens.
- Named themes merge over root tokens.
- `targetId = agentBrowser` applies variables to the Agent Browser shell.
- `targetId = widgets.<name>` applies variables to a widget scope such as `data-design-widget="button-primary"`.

## 6. Product Surfaces

### 6.1 Home

The home surface lists design projects, examples, and design systems. It MUST include the creation card, fidelity selector, recent/tutorial card, search, and design-system CTA shown in the screenshots.

Implementation:

- `DesignerPanel` exposes a Design Studio home with product branding, research-preview badge, `Designs`, `Examples`, and `Design systems` tabs.
- The left rail includes `Prototype`, `Slide deck`, `From template`, and `Other`, a project-name field, `Wireframe`/`High fidelity` selectors, a primary create action, privacy copy, and the design-system CTA.
- The Designs tab includes Recent/Your designs, tutorial card, prompt chip, and search. The Examples tab includes a calculator construction kit preview plus tweak controls. The Design systems tab includes create/default/template empty states.

### 6.2 Setup

The setup surface creates or updates `DESIGN.md` and `design/manifest.json`.

Inputs:

- Company name and blurb.
- GitHub repo URL.
- Local folder import.
- `.fig` file or design-file upload.
- Fonts, logos, and assets.
- Notes.

Outputs:

- A draft `DESIGN.md`.
- Source inventory in `design/manifest.json`.
- A generation run entry with tool/progress cards.

Implementation:

- `buildDesignSystemArtifacts` creates `DESIGN.md`, `design/manifest.json`, `design/colors_and_type.css`, `design/README.md`, `design/SKILL.md`, preview HTML, UI kit sample, and design folder placeholders.
- Source inputs are preserved in the manifest as GitHub, local-folder, `.fig`, assets, and notes records.

### 6.3 Generation

The generation surface streams status into chat and canvas:

- Chat shows tool cards and caveats.
- Canvas shows centered status and a bottom-right preview thumbnail.
- The run can continue across tabs without losing state.

Implementation:

- The generation state shows `Creating your design system...`, a progress line, a bottom-right thumbnail, and a review transition.
- The chat rail shows deterministic tool cards for todos, reading, searching, metadata review, and title setting.

### 6.4 Review

The review surface lets users approve or request changes by component area.

Required component review states:

- `needs-review`
- `approved`
- `needs-work`
- `regenerating`

Approved components stay approved unless their source tokens change.

Implementation:

- Review includes `Review draft design system`, published/default toggles, missing-font warning, component review cards, `Looks good`, `Needs work...`, feedback textarea, stored feedback history, and generated CSS preview.
- Component feedback updates `design/manifest.json` without replacing the DESIGN.md source.

### 6.5 Design Files

The design-files surface is a workspace file browser filtered to design assets. It MUST integrate with existing workspace file editing and support import drop zones.

Implementation:

- Design files are listed by folders, stylesheets, documents, sketches, exports, and other assets.
- Selecting a file previews its contents; the empty pane shows `Select a file to preview`.
- The drop-zone copy explicitly accepts images, docs, references, Figma links, or folders.

### 6.6 Sketch

The sketch surface is a canvas document. V1 MAY store sketch data as JSON under `design/sketches/*.json`, but the UI MUST present the dotted canvas and toolbar shape from the screenshots.

Implementation:

- Designer exposes a dotted sketch canvas with select, pan, pen, text, shapes, arrow, component/library, and save controls.
- Saving creates a deterministic `.napkin` workspace file under `design/sketches/` and records it in the manifest.

### 6.7 Share and Export

The share menu records intended export actions locally in v1. External integrations can be added later.

V1 menu items:

- Copy link.
- Access mode.
- File type.
- Duplicate project.
- Duplicate as template.
- Download project as `.zip`.
- Export PDF.
- Export PPTX.
- Send to Canva.
- Export standalone HTML.
- Handoff to code.

Implementation:

- The Share menu includes access mode, copy link, file type, duplicate project/template, zip, PDF, PPTX, Canva, standalone HTML, and agent handoff.
- Export actions create deterministic workspace artifacts under `design/exports/` and append export metadata to `design/manifest.json`.

## 7. Runtime Styling Contract

### 7.1 Applying to Agent Browser

The app shell MUST consume CSS variables for:

- `--app-bg`
- `--panel-bg`
- `--panel-bg-elevated`
- `--panel-bg-soft`
- `--panel-border`
- `--panel-border-strong`
- `--text-soft`
- `--text-muted`
- `--accent`
- `--accent-strong`

Switching the active `agentBrowser` token pack MUST update those variables without reloading the app.

### 7.2 Applying to Widgets

Widgets MAY declare a design target:

```html
<button data-design-widget="button-primary">Create</button>
```

The token engine MUST generate scoped variables for widget targets. Components can then bind their local styles to those variables.

### 7.3 Safety

- CSS variable names MUST be sanitized to lowercase kebab case.
- Values MUST be treated as CSS values only; no HTML injection.
- Unknown token references MUST be skipped and reported as diagnostics.

## 8. Interaction Details

### 8.1 Token Switching

Settings MUST expose a local control to:

- Select the active design theme.
- Toggle whether the theme applies to Agent Browser itself.
- Preview the generated CSS variables.
- Reset to the built-in app theme.

Implementation:

- Agent Browser Settings exposes Design Studio theme selection, shell application toggle, reset, diagnostics, and CSS preview.
- Designer Review exposes the same active theme selector and shell application toggle in context.

### 8.2 DESIGN.md Apply Tool

The `design-md.apply` tool MUST support:

- CSS token block insertion/replacement.
- Theme-aware token rendering.
- Target-aware CSS variable rendering.
- Diagnostics for missing references and unsupported targets.

Implementation:

- `harness-core/src/ext/design-md.ts` parses front matter, merges named themes, sanitizes CSS variable names, emits managed `design.md` blocks, renders target-specific variables, and reports diagnostics.
- `renderDesignMdCss` is exported from `harness-core` for Agent Browser runtime use.

### 8.3 Persistence

Runtime theme settings persist in local storage. Workspace files persist through the existing workspace file model.

## 9. Accessibility

- All tabs, buttons, file rows, share-menu items, review controls, and sketch toolbar controls require accessible names.
- Generated progress status should use live text that remains visible to screen readers.
- The token-switcher preview must not be color-only; it should show token names and values.
- Canvas toolbar buttons must include tooltips/titles.

## 10. Verification

Implementations MUST include:

- Unit tests for `DESIGN.md` parsing, theme merging, target references, CSS generation, and diagnostics.
- UI tests proving theme switching updates Agent Browser variables.
- A visual smoke screenshot for Agent Browser after the feature lands.
- Full repo gate for `agent-browser`: lint, eval manifest validation, coverage, build, audit, and visual smoke.

Current checked-in coverage:

- `harness-core/src/__tests__/designMdPlugin.test.ts` covers DESIGN.md parsing, theme merging, target references, managed block replacement, widget variables, diagnostics, and guidance preservation.
- `agent-browser/src/features/designer/designerModel.test.ts` covers artifact creation, manifest updates, local exports, sketches, and design file categorization.
- `agent-browser/src/features/designer/DesignerPanel.test.tsx` covers setup, generation, review, theme switching, files, examples, comments, sketches, share/export, and handoff flows.
- `agent-browser/src/App.test.tsx` covers navigation into Designer and generation of DESIGN.md-backed files from the integrated app shell.

## 11. V1 Acceptance Criteria

- A checked-in `SPEC.md` exists for this feature.
- `DESIGN.md` can define root tokens, named themes, and target style mappings.
- Generated CSS includes generic variables and target-specific variables.
- `design-md.apply` can replace a managed block without duplicating markers.
- Agent Browser Settings exposes a Design Studio section with theme selection, apply-to-shell toggle, and generated CSS preview.
- Applying a theme updates the Agent Browser shell CSS variables at runtime.
- Existing DESIGN.md guidance injection still works for design-facing model requests.

## 12. V2 Parity Acceptance Criteria

- Designer can be opened from Agent Browser primary navigation.
- Home parity covers Designs, Examples, Design systems, prototype setup, fidelity selection, search, tutorial, examples, and design-system CTA.
- Setup parity covers back/continue actions, spinner, company blurb, GitHub, local folder, `.fig`, assets, fonts/logos, and notes.
- Generation parity covers chat-side tool progress, centered canvas progress, bottom-right thumbnail, and review transition.
- Review parity covers published/default toggles, font warning, component approval/request-change loop, feedback history, CSS preview, and contextual theme application.
- Files parity covers expected folder/file sections, selection preview, empty preview state, and import drop zone.
- Sketch parity covers dotted canvas, floating toolbar, save behavior, and generated sketch artifacts.
- Share/export parity covers access, copy link, file type, duplicate actions, zip/PDF/PPTX/Canva/HTML exports, and agent handoff as local artifacts.
- Runtime theme parity covers DESIGN.md-driven token parsing, CSS rendering, shell token swapping, widget target variables, diagnostics, and local persistence.

## 13. Future Work

- Real asset ingestion and local image metadata extraction.
- Canvas object model with editable shapes and comments.
- External-service export implementations for Canva and binary PDF/PPTX generation.
- Organization-scoped published/default design systems.
- Versioned design-system review history.
