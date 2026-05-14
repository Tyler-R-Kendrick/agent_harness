# Reference Architecture: Portable Updated Context Pipeline (PUCP)

## Goal

Implement a repository-native context system that keeps knowledge fresh and compact for `agent-browser` chat agents.

## Components

1. **Source Store (`Raw/`)**
   - Immutable source documents (notes, docs, transcripts, specs).
   - Each source receives stable `sourceId` and hash.

2. **Ingestion Queue (`_pending.md`)**
   - Deterministic queue for new/changed source IDs.
   - Supports idempotent retries.

3. **Knowledge Graph Pages (`Wiki/`)**
   - Topic pages synthesized from sources.
   - Structured sections: facts, decisions, open questions, references.

4. **Hot Context Builder (`_hot.md`)**
   - Produces bounded, high-signal context tailored for active tasks.
   - Token budget + recency + importance scoring.

5. **Audit Log (`_log.md`)**
   - Append-only run records with timestamps, source counts, and deltas.

6. **Agent Runtime Bridge**
   - Injects generated hot context into chat-agent system prompts or memory preloads.

## Data flow

1. Discover new/changed sources.
2. Queue source IDs.
3. Compile queue into wiki patches.
4. Rebuild hot context under token cap.
5. Emit immutable run log.
6. Expose result through agent runtime bridge.

## Safety and validation gates

- **Schema gate**: require typed records for source metadata and events.
- **Provenance gate**: each synthesized claim must carry at least one source reference.
- **Budget gate**: hot context must remain <= configured token/char budget.
- **Determinism gate**: stable ordering for repeatable outputs.

## Rollout policy

1. Phase 1: local developer-mode pipeline with markdown stores.
2. Phase 2: connect bridge into one internal chat agent.
3. Phase 3: broaden to multiple agents + scheduled automation cadences.

## Metrics

- Hot context generation latency.
- Percentage of responses that use a cited wiki fact.
- Hallucination rate relative to source corpus.
- Update freshness (time from source change to hot-context availability).
