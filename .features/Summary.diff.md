# Summary Diff For Linear Feature Generation

Updated: 2026-05-21
Baseline: `.features/Summary.md` refreshed from the 2026-05-19 Warp-updated corpus.
Diff type: additive update after ChatGPT feature refresh

## Net new normalized features

### Added: Inspectable personalization provenance and source-level memory controls
- Why now: the refreshed ChatGPT corpus adds a clearer contract for inspectable personalization, where the product exposes which memories and prior context influenced an answer and lets the user correct or suppress those sources inline.
- Research delta:
  - ChatGPT now exposes Memory Sources for personalized responses, including past chats, saved memories, custom instructions, and where eligible, files and connected Gmail
  - each source can be corrected, deleted, or marked as not relevant directly from the response context instead of through a separate memory admin flow
  - project memory can be forced into a project-only boundary and reusable sources can be added from Slack, Google Drive, saved chats, or ad-hoc pasted text
  - synced apps can now feed both immediate answers and longer-lived memory/personalization flows, which makes provenance and suppression controls more important

### Expanded: Persistent memory plus project instructions
- Why now: the ChatGPT refresh makes its memory system more operationally inspectable and its project knowledge base more intentionally curated than the older corpus captured.
- Research delta:
  - project-only memory now acts as a hard context boundary for shared work
  - project sources can be created from apps, chats, and raw pasted text
  - reusable outputs can be saved back into the project as durable sources
  - personalization now shows source provenance rather than behaving like a hidden retrieval layer

### Expanded: External tool connectivity and actionability
- Why now: the ChatGPT refresh shows a cleaner bridge from synced external knowledge to action-capable app upgrades and in-place work surfaces.
- Research delta:
  - apps with sync can pre-index external knowledge while respecting existing permissions
  - upgraded apps can preserve sync while adding new actions
  - ChatGPT for Excel and Google Sheets carries apps and Skills into a host-native sidebar instead of limiting the harness to the main chat window

### Added: Add memory provenance chips and source-level personalization controls
- Why now: `agent-browser` already stores transcripts, artifacts, and instructions, but it does not show which durable context actually influenced a given answer, nor does it let the user suppress or correct stale context at the point of use.
- Linear issue:
  - Pending external publication in this session if the Linear plugin remains non-callable in this environment; the feature brief below is the canonical issue payload
- Linear issue title:
  - `Add memory provenance chips and source-level personalization controls`
- Suggested problem statement:
  - `agent-browser` keeps durable context in transcripts, memories, instructions, artifacts, and external sources, but users still cannot see which of those sources influenced a specific response. When personalization goes stale or overreaches, the only recovery path is indirect cleanup rather than point-of-use correction. This makes long-lived memory harder to trust, especially once project notes, prior runs, and external synced sources all participate in context assembly.`
- One-shot instruction for an LLM:
  - Implement response-level memory provenance for `agent-browser` so each answer can surface the project notes, prior runs, durable instructions, artifacts, and external sources that materially influenced it; add compact provenance chips plus a detail panel where the user can mark each source relevant or not relevant, exclude it from future personalization, edit durable memories, or jump to the underlying artifact, and wire the suppression feedback into future context assembly rather than only hiding the chip in the current view.
