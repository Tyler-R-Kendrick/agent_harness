# Summary Diff For Linear Feature Generation

Updated: 2026-06-03
Baseline: `.features/Summary.md` refreshed through the 2026-06-02 Codex corpus.
Diff type: additive updates after the 2026-06-03 ChatGPT refresh

## Net new normalized features

### Added: Meeting capture that turns recordings into reusable plans and code
- Why now: the refreshed ChatGPT corpus shows the harness absorbing live spoken work sessions directly into durable agent context instead of treating meetings and voice notes as out-of-band input.
- Research delta:
  - ChatGPT Record now transcribes and summarizes meetings, brainstorms, and voice notes into durable notes or canvases
  - those notes can be rewritten into emails, project plans, or even code scaffolds instead of stopping at plain transcripts
  - `Reference record history` lets past recordings inform later conversations, which turns one meeting into reusable context for future agent work
  - workspace owners can disable Record and `Reference record history`, which means this is already framed as a governed workspace capability rather than a consumer-only convenience
  - current OpenAI positioning treats spoken planning sessions as an intake surface that can feed downstream execution artifacts

## Expanded normalized features

### Expanded: External tool connectivity and actionability
- Why now: the refreshed ChatGPT corpus pushes apps from simple connected sources toward governed read/write action surfaces with workspace-level policy controls.
- Research delta:
  - updated Box, Notion, Linear, and Dropbox apps add newer action surfaces in ChatGPT, including write capabilities where supported
  - Google and Microsoft app write actions remain disabled by default until workspace admins explicitly enable them
  - Business workspaces now support a simplified app-action model with `all actions`, `read actions only`, or custom action controls, plus policy for how future actions are treated
  - the product is making app-action governance explicit instead of leaving write enablement implicit in the connection step

### Expanded: Operator control consoles with blocked-state queues and durable usage ledgers
- Why now: ChatGPT now exposes a global admin console that combines workspace analytics with an inspectable registry of shared agents.
- Research delta:
  - the new `Analytics` area shows active-user and message trends plus drilldowns for GPTs, projects, skills, tool interactions, connector interactions, and workspace health
  - the new `Agents` area lets admins inspect Agent ID, recent activity, connected apps, memory files, schedules, and unique users or runs over time
  - admins can jump from that registry into Builder to edit the selected agent
  - the dedicated analytics help article adds project and skill usage trends, task insights, benchmarks, impact surveys, and CSV exports, which confirms OpenAI is treating agent operations as an admin surface rather than hidden telemetry

## Linear-ready feature payloads

### Proposed Linear feature: Add meeting capture that turns recordings into reusable plans and code
- Linear issue title:
  - `Add meeting capture that turns recordings into reusable plans and code`
- Suggested problem statement:
  - `agent-browser` already handles typed instructions, files, and browser state well, but a large amount of planning, debugging, and coordination still happens in spoken meetings, brainstorms, and voice notes outside the harness. Competitors are beginning to capture those sessions directly, turn them into durable notes, and then reuse that material to generate plans, follow-ups, and even code. Without a meeting-capture path, teams lose high-signal context after calls, manually rewrite decisions into prompts or tickets, and break continuity between discussion and execution. The product needs a governed recording-to-artifact workflow that converts spoken sessions into reusable agent context with explicit retention and reuse controls.`
- One-shot instruction for an LLM:
  - Implement meeting capture for `agent-browser`: let a user start or import a live recording from a desktop session, generate an editable transcript plus structured notes, save the resulting artifact as durable thread context separate from ordinary chat text, support transformations into follow-up emails, implementation plans, tickets, and starter code, allow optional cross-session reuse of past recordings through an explicit history toggle, and add workspace-owner controls for enablement, retention, deletion, and whether prior recording artifacts may inform future runs.
