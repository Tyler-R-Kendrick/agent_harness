# Summary Diff For Linear Feature Generation

Updated: 2026-05-19
Baseline: `.features/Summary.md` refreshed from the 2026-05-18 GitHub Copilot-updated corpus.
Diff type: additive update after Warp feature refresh

## Net new normalized features

### Added: Steerable remote runs with local takeover
- Why now: the refreshed Warp corpus shows a stronger product contract around remote agent supervision, where cloud runs stay open as inspectable sessions and can move back onto a developer machine instead of ending as static transcripts.
- Research delta:
  - Warp's cloud-session viewer exposes commands, logs, context, plans, and outputs while the remote VM is still running
  - follow-up prompts can be sent into the same remote session after the first task finishes, so background work becomes a live conversational surface
  - when the remote VM ends, Warp exposes a `Fork to local` path so the same run can continue on the developer's machine without starting over
  - the same session can be watched from Warp or directly in a browser, which turns remote execution into a shareable and steerable artifact instead of a black-box job

### Expanded: Skills, plugins, and reusable workflow packaging
- Why now: Warp is packaging reusable prompt logic more like runnable infrastructure than like static prompt snippets.
- Research delta:
  - Warp can auto-discover repo-defined skills and publish them into the Oz agent catalog
  - those skills can be launched visually, from the CLI, or through the API
  - scheduled runs can target a skill directly, which collapses the gap between workflow packaging and background automation

### Expanded: Operator control consoles with blocked-state queues and durable usage ledgers
- Why now: the Warp refresh adds a clearer operations surface than the older notes captured.
- Research delta:
  - the management view now spans interactive conversations and cloud runs in one scannable list
  - each run exposes source, status, duration, creator, and credit usage before opening the full transcript
  - the same control plane is available through Warp and the mobile-friendly `oz.warp.dev` web app

### Added: Add steerable remote runs with fork-to-local handoff
- Why now: `agent-browser` already stores session history and artifacts, but it still treats local and remote execution as separate modes rather than one continuable run that a user can inspect live, steer after the initial result, and adopt locally when needed.
- Linear issue:
  - Pending external publication in this session because the Linear connector did not surface callable tools and no `LINEAR_API_KEY` is available locally
- Linear issue title:
  - `Add steerable remote runs with fork-to-local handoff`
- Suggested problem statement:
  - `agent-browser` can run work locally and it can preserve transcripts and artifacts, but it does not yet let a long-running background or remote session stay open as a live collaborative surface with follow-up turns, nor can a user adopt that same run into a local workspace when the remote environment is done or blocked. Users still have to reconstruct the state transition by reopening transcripts or restarting the task in another mode, which breaks continuity across supervision, debugging, and final local finishing.`
- One-shot instruction for an LLM:
  - Implement steerable remote-run handoff for `agent-browser` so background, worktree, and remote sessions remain inspectable live, accept follow-up turns after the first result, and can be adopted into a local workspace with the same transcript, artifacts, approvals, and diff context preserved; add an operator-facing session view plus a `fork to local` action that resumes the exact run instead of starting a new thread.
