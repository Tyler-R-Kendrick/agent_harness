# Summary Diff For Linear Feature Generation

Updated: 2026-05-18
Baseline: `.features/Summary.md` refreshed from the 2026-05-17 OpenAI Symphony-updated corpus.
Diff type: additive update after GitHub Copilot feature refresh

## Net new normalized features

### Added: Searchable run history and cross-session debug recall
- Why now: the refreshed GitHub Copilot corpus shows a major harness turning past agent work into a queryable product surface instead of leaving it trapped inside transcripts or one-off logs.
- Research delta:
  - GitHub Copilot's experimental `/chronicle` stores chat interactions in a local database and can recall touched files, referenced pull requests, and prior work across sessions
  - the Agent Debug Log panel now persists logs locally, so earlier agent runs stay inspectable after the active thread ends
  - session titles and ordering are being normalized across CLI and GitHub surfaces, which turns past runs into a manageable index instead of an ephemeral terminal artifact

### Expanded: Persistent memory plus project instructions
- Why now: GitHub Copilot is broadening memory from repository facts into portable user preferences and more inspectable instruction layering.
- Research delta:
  - Copilot Memory now supports user-level preferences such as commit style, PR structure, and communication defaults for eligible plans
  - VS Code custom-instruction diagnostics now show which instruction sources loaded and why
  - Spaces plus instruction files are becoming a layered grounding stack instead of one opaque prompt

### Expanded: Browser use and computer control
- Why now: the Copilot refresh shows a stronger move from static code chat into live browser and terminal state sharing.
- Research delta:
  - the integrated browser can share live tabs with the agent for page reading and interaction
  - open-terminal access lets the agent read and write to existing REPLs and interactive scripts instead of only launching isolated commands

### Expanded: External tool connectivity and actionability
- Why now: GitHub is exposing Copilot cloud agent as automation infrastructure, not only as an interactive UI.
- Research delta:
  - the new Agent tasks REST API can start and track cloud-agent runs programmatically
  - IDE agent mode can access Copilot Spaces through the GitHub MCP server instead of requiring a separate manual context hop

### Added: Add a searchable run chronicle with debug-log recall
- Why now: `agent-browser` already stores sessions, artifacts, and evidence, but it still does not give users one searchable history surface that answers what happened in earlier runs without reopening each transcript manually.
- Linear issue:
  - `TK-67`
- Linear issue title:
  - `Add a searchable run chronicle with debug-log recall`
- Suggested problem statement:
  - `agent-browser` stores transcripts, evidence, and session state, but it still makes users reconstruct prior agent work by opening one run at a time and manually scanning chat history. There is no searchable chronicle that answers which files a run touched, which commands it executed, which artifacts it produced, which pull request it referenced, or how a previous failure looked in debug logs. As the product adds more long-running local, worktree, and remote sessions, history retrieval is becoming an operator problem instead of just a storage problem.`
- One-shot instruction for an LLM:
  - Implement a searchable run chronicle for `agent-browser` that indexes local, worktree, and remote agent sessions with touched files, commands, artifacts, linked issues or pull requests, and persisted debug logs; expose that history through the main UI with filtering and full-text lookup, and let users jump from a search hit into the exact transcript, artifact, diff, or log segment so prior work can be reused, audited, or resumed without replaying an entire thread.
