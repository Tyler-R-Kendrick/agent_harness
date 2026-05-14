# Give Your AI Unlimited Updated Context (Towards Data Science, 2026)

- Article: **Give Your AI Unlimited Updated Context**
- Canonical link: https://towardsdatascience.com/give-your-ai-unlimited-updated-context/
- Publication date: 2026-05-07 (from public mirrors referencing the TDS post)

## What this article proposes

The article presents a practical **LLM Wiki knowledge vault** pattern that keeps AI context continuously current without repeatedly re-prompting from scratch.

From available public summaries, the core design has:

1. A `Raw/` folder for immutable source material.
2. A `Wiki/` folder for continuously synthesized, structured knowledge.
3. Three control files:
   - `_hot.md` (fast cache of currently relevant context)
   - `_pending.md` (ingestion/update queue)
   - `_log.md` (append-only audit log)
4. Operational cadences:
   - daily ingestion
   - weekly compilation/synthesis
   - monthly linting/cleanup

## Extracted capability to implement

### Capability name

**Portable Updated Context Pipeline (PUCP)**

### Capability definition

A deterministic pipeline that ingests new source documents, compiles structured knowledge pages, and emits compact “hot context” bundles that can be injected into any chat-agent runtime.

### Why it matters to agent-browser

- Replaces fragile per-session restating of project context.
- Supports portable, model-agnostic context packs for different agents.
- Preserves provenance and update history for safer agent reasoning.

## Minimal algorithm sketch

1. Detect new artifacts in `Raw/` and enqueue to `_pending.md`.
2. Normalize and chunk pending artifacts.
3. Merge extracted facts into `Wiki/` topic pages with source citations.
4. Recompute `_hot.md` as bounded-size distilled context.
5. Append a structured event to `_log.md`.
6. Publish the hot context bundle to agent runtime input.

## Deliverables in this folder

- `reference-architecture.md` — architecture + integration plan for agent-browser.
- `experiments/experiment-01-context-pipeline.md` — experiment plan and acceptance criteria.
- `experiments/experiment-01-context-pipeline.ts` — TypeScript scaffold implementing the core loop.
