# Warp Drive Workflows And Notebooks

- Harness: Warp
- Sourced: 2026-05-19

## What it is
Warp Drive turns commands, notebooks, and team knowledge into reusable assets that the agent and human can both invoke, share, search, and parameterize.

## Evidence
- Official docs: [Warp Drive Overview](https://docs.warp.dev/knowledge-and-collaboration/warp-drive/overview)
- Official docs: [Workflows](https://docs.warp.dev/knowledge-and-collaboration/warp-drive/workflows)
- Official docs: [Notebooks](https://docs.warp.dev/knowledge-and-collaboration/warp-drive/notebooks)
- First-party details:
  - workflows are parameterized commands with text or enum arguments, search metadata, aliases, and team editing
  - Warp can use an agent to autofill workflow titles, descriptions, and parameters from the command being packaged
  - notebooks mix runnable terminal blocks with explanatory text, making them closer to operational playbooks than plain docs
  - Drive assets are searchable, shareable, and attachable as context in CLI agent runs instead of forcing users to remember hidden scripts or prompts
- Latest development checkpoint:
  - Warp still positions Drive as a major collaboration layer, and the newer workflow editor plus AI autofill tighten the bridge between repeatable commands and packaged agent behavior

## Product signal
Warp treats reusable operational docs as executable product artifacts, which is relevant for any harness that wants team workflows to outlive individual prompt threads.
