# Summary Diff For Linear Feature Generation

Updated: 2026-05-29
Baseline: `.features/Summary.md` refreshed through the 2026-05-28 OpenAI Symphony corpus.
Diff type: additive updates after the Mastra refresh

## Net new normalized features

### Added: Runtime-editable agent configs with draft, publish, compare, and rollback
- Why now: the Mastra refresh surfaced a mature runtime editor rather than another static prompt file or hidden admin form. Agent behavior can now be changed from the harness control plane with a real lifecycle.
- Research delta:
  - Mastra Agent Editor lets teams update instructions, tools, MCP clients, variables, and display conditions from Studio without editing code or redeploying
  - changes are stored separately from the code-defined agent and move through draft and publish states with comparison history and rollback
  - the same surface is exposed programmatically through `mastra.getEditor()` and `/api/stored/agents`, so the editor is part of the platform contract rather than a UI-only shortcut
  - Mastra ties the editor to Studio Auth and role-aware access, which makes publish rights and read-only access governable in the same place as observability and evals

## Expanded normalized features

### Expanded: Parallel agent orchestration
- Why now: Mastra is moving from internal supervisor-only coordination toward interoperable agent fabrics.
- Research delta:
  - the current feature line includes explicit Agent-to-Agent support for cross-framework multi-agent systems
  - recent releases say ACP-compatible coding agents can be used anywhere Mastra accepts a `SubAgent`, including supervisor delegation and workflow steps
  - this extends Mastra beyond same-runtime routing and into open heterogeneous coordination

### Expanded: Skills, plugins, and reusable workflow packaging
- Why now: Mastra now treats stored agents and skills as discoverable catalog objects, not just persisted blobs.
- Research delta:
  - the May 15, 2026 release adds a `favorites` storage domain for agents and skills
  - stored agents and skills now carry `visibility` and `favoriteCount` fields for filtering, ranking, and public or private curation
  - the same release wires the feature across major storage adapters, making the catalog behavior portable rather than backend-specific

### Expanded: Multi-surface continuity
- Why now: Mastra's current harness can accept work from external chat surfaces without cloning agent logic.
- Research delta:
  - Channels let one agent respond across Slack, Discord, Telegram, and similar surfaces through adapter-based ingress
  - each adapter gets a first-party webhook endpoint while the same agent remains testable and observable in Studio
  - Mastra explicitly positions channels as additive surfaces rather than a forked per-platform bot architecture

### Expanded: Queued steering with visible progress drafts
- Why now: Mastra's May 2026 background-task work strengthens the argument that long-running turns need explicit visible progress rather than silent blocking.
- Research delta:
  - the feature line now includes `Introducing Background Tasks for Mastra Agents`, focused on progress feedback during long-running tool calls
  - that sits on top of Mastra's existing background process handles, workflow suspend/resume continuity, and Studio observability
  - the combined signal is that progress visibility is becoming a runtime expectation, not a polish feature

## Linear-ready feature payloads

### Proposed Linear feature: Add a runtime agent editor with draft, publish, compare, and rollback
- Linear issue title:
  - `Add a runtime agent editor with draft, publish, compare, and rollback`
- Suggested problem statement:
  - `agent-browser` supports configurable agents, repo instructions, and skills, but production tuning is still too code-centric. Changing instructions, tool assignment, or conditional behavior generally requires editing files, opening a PR, and redeploying before non-engineering stakeholders can evaluate the result. That slows iteration, keeps high-signal product and operations feedback outside the harness, and makes it harder to compare candidate configurations or roll back a bad change cleanly. The harness needs a governed runtime editing surface that preserves the code-defined baseline while letting authorized users draft, test, compare, publish, and revert agent configuration changes without treating every prompt or tool tweak like a source-code release.`
- One-shot instruction for an LLM:
  - Implement a runtime configuration editor for `agent-browser`: let authorized users create draft edits to agent instructions, tool assignments, MCP connections, variables, and conditional behaviors; preserve a code-defined baseline plus version history; support compare, test, publish, and rollback actions; expose the same lifecycle through a programmatic API; and apply role-aware access controls so viewing, drafting, and publishing can be governed separately.
