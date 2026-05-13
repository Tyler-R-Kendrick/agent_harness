# Structured Brief Locking And Direction Picker

- Harness: Open Design
- Sourced: 2026-05-13

## What it is
Open Design forces a short structured discovery pass before generation, then offers curated visual directions with deterministic palettes and font stacks instead of letting the model freestyle the brief from raw chat alone.

## Evidence
- Official README: [Open Design](https://github.com/nexu-io/open-design)
- First-party details:
  - the entry flow asks users to pick a skill, pick a design system, and type a brief in one dedicated surface
  - the turn-one discovery form locks surface, audience, tone, brand context, and scale before the model generates an artifact
  - the direction picker offers five curated visual schools
  - each direction maps to a deterministic OKLch palette and font stack
- Latest development checkpoint:
  - the May 2026 README still presents this structured intake flow as the default starting point for the product rather than an optional advanced mode

## Product signal
Open Design is treating prompt intake as a productized contract instead of an unstructured chat preamble, which raises the floor on first-pass output quality.
