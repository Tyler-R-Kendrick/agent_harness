# Plan And Act Modes

- Harness: Cline
- Sourced: 2026-04-30

## What it is
Cline separates reasoning from execution with explicit `Plan` and `Act` modes, so users can explore a codebase and agree on an approach before any writes or commands happen.

## Evidence
- Official docs: [Plan & Act Mode](https://docs.cline.bot/core-workflows/plan-and-act)
- First-party details:
  - the docs describe Plan & Act as a dual-mode system for structured development
  - Plan mode can explore and strategize without changing files
  - Act mode executes against the approved plan with the planning context preserved
  - `/deep-planning` is positioned as the heavier-weight path for complex multi-file work

## Product signal
This makes staged execution a first-class interface concept rather than an informal prompting habit, which is directly relevant to any harness that wants safer high-agency behavior.
