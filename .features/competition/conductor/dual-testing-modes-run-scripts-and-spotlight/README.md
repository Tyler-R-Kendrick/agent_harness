# Dual Testing Modes Run Scripts And Spotlight

- Harness: Conductor
- Sourced: 2026-05-12

## What it is
Conductor separates normal repo-script execution from a dedicated Spotlight testing flow, giving teams both standard validation hooks and a more guided test-driving surface.

## Evidence
- Official docs: [Testing](https://www.conductor.build/docs/concepts/testing)
- Official docs: [Checks tab](https://www.conductor.build/docs/reference/checks-tab)
- First-party details:
  - Conductor can run project-defined validation scripts inside the workspace
  - the product also documents Spotlight as a dedicated testing mode rather than only raw shell execution
  - testing is positioned as part of the core workspace lifecycle, not a disconnected CI-only concern
- Latest development checkpoint:
  - the current docs still distinguish between normal checks and richer guided testing flows, which suggests Conductor sees testing as a product surface rather than a thin wrapper around `npm test`

## Product signal
Harnesses are increasingly treating validation as an operator experience with dedicated UX, not just as a command whose logs happen to be visible.
