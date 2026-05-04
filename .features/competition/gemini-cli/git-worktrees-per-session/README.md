# Git Worktrees Per Session

- Harness: Gemini CLI
- Sourced: 2026-05-04

## What it is
Gemini CLI has a first-class git worktree workflow so users can launch isolated sessions against separate branches or tasks without duplicating the full repository checkout by hand.

## Evidence
- Official docs: [Git Worktrees](https://geminicli.com/docs/cli/git-worktrees/)
- First-party details:
  - the docs explain starting Gemini CLI sessions from dedicated git worktrees for isolation
  - the feature is framed as a way to parallelize work safely across tasks or experiments
  - worktree-aware operation is documented in the product surface instead of being left as generic git advice
- Latest development checkpoint:
  - worktree guidance is still presented as a product feature in the current Gemini CLI docs.

## Product signal
Gemini CLI treats branch isolation as a harness concern, not only a developer habit. That keeps multi-task work safer and fits the broader market shift toward multi-agent and parallel-run workflows.
