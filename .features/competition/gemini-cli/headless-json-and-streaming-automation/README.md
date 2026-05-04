# Headless Json And Streaming Automation

- Harness: Gemini CLI
- Sourced: 2026-05-04

## What it is
Gemini CLI offers headless execution with machine-readable output modes so the harness can be embedded in scripts, CI, or other control planes without screen-scraping interactive terminal output.

## Evidence
- Official docs: [Headless Mode](https://geminicli.com/docs/cli/headless/)
- First-party details:
  - Gemini CLI supports non-interactive execution for scripted and automated workflows.
  - The docs expose structured output modes including JSON and streaming-friendly surfaces.
  - Headless execution is positioned for automation pipelines rather than as an unsupported side effect of the CLI.
- Latest development checkpoint:
  - headless automation remains part of the active CLI surface in the current docs.

## Product signal
Gemini CLI is exposing the harness as a programmable runtime, not only a human-facing shell. Structured output and headless execution are increasingly table stakes for orchestrated agent systems.
