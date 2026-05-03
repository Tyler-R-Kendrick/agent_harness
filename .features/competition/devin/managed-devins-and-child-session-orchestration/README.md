# Managed Devins And Child Session Orchestration

- Harness: Devin
- Sourced: 2026-05-02

## What it is
Devin now treats parallel sub-work as a first-class runtime pattern through managed child sessions, structured child outputs, and an Advanced Mode that explicitly orchestrates multiple Devins in parallel.

## Evidence
- Official release notes: [Devin Release Notes 2026](https://docs.devin.ai/release-notes/2026)
- Official docs: [Advanced Mode](https://docs.devin.ai/product-guides/advanced-mode)
- First-party details:
  - the January 22, 2026 release added child sessions plus session-origin metadata so one Devin run can start and track additional Devin work
  - the February 3, 2026 release added structured output support for child sessions, which turns sub-session results into something programmatic instead of just more transcript
  - current Advanced Mode docs describe Devin as able to orchestrate managed Devins in parallel rather than only handling one foreground thread
- Latest development checkpoint:
  - the current docs and 2026 release notes position multi-Devin orchestration as an active product direction, not a one-off beta primitive

## Product signal
Devin is pushing beyond single-thread agent chat into supervisor-style orchestration where sub-runs can be launched, tracked, and consumed as structured work products.
