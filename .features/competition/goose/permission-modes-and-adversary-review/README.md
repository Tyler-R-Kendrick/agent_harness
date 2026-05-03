# Permission Modes And Adversary Review

- Harness: Goose
- Sourced: 2026-05-03

## What it is
Goose exposes multiple autonomy levels for tool use and file edits, then layers Adversary Mode on top as a silent second-agent reviewer that can block risky tool calls before execution.

## Evidence
- Official docs: [goose Permission Modes](https://goose-docs.ai/docs/guides/goose-permissions/)
- Official docs: [Adversary Mode](https://goose-docs.ai/docs/guides/security/adversary-mode)
- First-party details:
  - Goose supports `Completely Autonomous`, `Manual Approval`, `Smart Approval`, and `Chat Only` modes.
  - Permission mode can be changed before or during a session and controls file modification, extension usage, and automated actions.
  - Adversary Mode adds an independent reviewer that checks each tool call against the original task, recent messages, and user rules.
  - The adversary returns `ALLOW` or `BLOCK`, and blocked calls are denied before execution.
  - Goose presents this as protection against prompt injection, model compromise, or actions that drift away from user intent.
- Latest development checkpoint:
  - Goose is not stopping at coarse approval modes; it is moving toward contextual, runtime safety review at the individual tool-call level

## Product signal
Goose treats safety as an active control loop, not only as a permission dialog. Context-aware reviewer agents are becoming part of the execution engine.
