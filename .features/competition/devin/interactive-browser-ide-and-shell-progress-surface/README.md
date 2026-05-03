# Interactive Browser, IDE, And Shell Progress Surface

- Harness: Devin
- Sourced: 2026-05-02

## What it is
Devin exposes one workspace where users can watch browser steps, IDE edits, shell commands, plan progress, and test outputs without switching tools or guessing what the agent is doing.

## Evidence
- Official docs: [Interactive Browser](https://docs.devin.ai/product-guides/tools/interactive-browser)
- Official docs: [Overview](https://docs.devin.ai/)
- Official docs: [The Progress Tab](https://docs.devin.ai/product-guides/sessions/the-progress-tab)
- First-party details:
  - Devin documents an interactive browser as a built-in tool inside the working session
  - the product overview emphasizes an integrated shell, editor, and browser rather than a text-only chat loop
  - the Progress tab is presented as a live operational surface for plans, actions, and state transitions while work is running
- Latest development checkpoint:
  - the current product docs still center the unified progress workspace as core UX, which keeps Devin distinct from harnesses that only show tool output inline in a transcript

## Product signal
Operational trust improves when the user can inspect the live workspace directly instead of reverse-engineering the run from sparse text narration.
