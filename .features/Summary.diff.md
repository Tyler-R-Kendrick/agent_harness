# Summary Diff For Linear Feature Generation

Updated: 2026-05-27
Baseline: `.features/Summary.md` refreshed from the 2026-05-26 corpus.
Diff type: additive update after Kimi AI refresh

## Net new normalized features

### Added: Artifact-to-skill conversion from finished work
- Why now: the Kimi AI refresh shows a first-party product flow where strong documents are no longer just references or memory sources. They can be turned into reusable skills and then re-applied in future runs.
- Research delta:
  - the current K2.6 page exposes a `Document to skills` flow from the main product surface rather than burying it in niche docs
  - the help center says generated skills can bundle methodology, standards, scripts, tools, and references, which is materially richer than a saved prompt
  - Kimi explicitly positions these artifact-derived skills as reusable across Agent, Kimi Code, and Kimi Claw contexts
  - Kimi also ties the feature to Agent Swarm, positioning captured skills as a way to improve consistency across large multi-agent runs

### Expanded: Parallel agent orchestration
- Why now: Kimi AI is no longer limited to a single orchestrator spawning homogeneous specialists. `Claw Groups` expands the pattern into a shared workspace for mixed humans and agents with different models, tools, and contexts.
- Research delta:
  - the K2.6 product page says users can bring agents with different tools, contexts, and models into one shared space
  - the coordinator handles task assignment and dependency tracking rather than just sub-agent spawning
  - the Kimi Claw help center now includes `Claw Group Chat overview` in the navigation, showing that this is becoming a productized surface rather than a research aside

### Expanded: Multi-surface continuity
- Why now: Kimi's coding surface is now clearly part of the harness family rather than a separate tool line.
- Research delta:
  - Kimi Code now spans CLI, VS Code, and third-party coding-agent usage with shared membership-backed access
  - official clients use OAuth `/login` and extension-side login flows, while third-party tools can reuse Kimi Code through API-key access
  - the docs explicitly call out compatibility with adjacent coding harnesses such as Claude Code

## Linear-ready feature payload

### Linear issue
- Pending external publication in this session because the Linear plugin is listed but not exposing callable Linear issue tools in this environment; the feature brief below is the canonical issue payload

### Linear issue title
- `Add artifact-to-skill generation from documents and examples`

### Suggested problem statement
- `agent-browser` already supports skills, prompts, and repo instructions, but it still assumes users or developers will author those workflow packages manually. In practice, teams already have high-signal artifacts such as PRDs, reports, templates, playbooks, and gold-standard deliverables that encode the workflow they want the harness to reuse. Today there is no first-class path to ingest those artifacts, extract the stable methodology and output structure, and turn them into a reviewable reusable skill. That keeps valuable process knowledge trapped in static files and makes skill authoring slower, less accessible, and less likely to stay aligned with the real artifacts teams already trust.`

### One-shot instruction for an LLM
- Implement artifact-to-skill generation for `agent-browser`: add a flow that accepts a strong example document or artifact set, extracts reusable workflow instructions, output structure, and referenced assets, converts that into a first-class skill package with editable metadata and generated instructions, shows a review screen before activation, stores provenance back to the source artifact, and makes the resulting skill available for future task routing across chat, browser, coding, and background-run surfaces.
