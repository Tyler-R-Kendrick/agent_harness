# Reference Architecture: Proxy Pointer Framework (PPF)

## Objective

Bring structure-aware document intelligence into the agent harness stack with deterministic retrieval primitives that can later be composed with LLM reasoning.

## Components

1. **Document Structure Extractor**
   - Input: OCR/layout parser output (paragraphs, headers, tables, cells, form fields).
   - Output: `DocumentRegion[]` with stable IDs and bounding boxes.

2. **Proxy Pointer Builder**
   - Builds a typed directed graph over regions.
   - Edge taxonomy:
     - hierarchy (`parent`, `child`)
     - sequencing (`next`, `previous`)
     - spatial (`nearby`, `overlap`)
     - semantic (`table-header-of`, `label-for`)

3. **Pointer Retrieval Engine**
   - Query-to-region lexical scoring.
   - Structural expansion via bounded BFS over pointer graph.
   - Weighted re-ranking with provenance path retention.

4. **Evidence Bundle Formatter**
   - Emits explainable retrieval output:
     - top regions
     - pointer path explanation
     - per-feature score breakdown

5. **Agent Integration Layer**
   - Exposes retrieval bundles to agent-browser chat agents as tool/resource payloads.
   - Keeps retrieval deterministic and auditable before any generative summarization.

## Data flow

1. Ingestion -> structure extraction.
2. Graph build -> stored pointer graph.
3. Query -> lexical seed nodes.
4. Graph walk + re-rank -> evidence bundles.
5. LLM orchestration consumes bundles for final synthesis/citations.

## Safety/validation gates

- Ensure every region has deterministic ID.
- Reject cyclic pointer expansion beyond max depth.
- Enforce score explainability (feature-level contributions logged).
- Preserve original region references in all outputs.

## Rollout policy

1. **Offline phase**: replay historical enterprise docs and compare against chunk-only baseline.
2. **Shadow phase**: produce parallel evidence bundles for live queries without user impact.
3. **Assisted phase**: enable pointer bundles for selected domains (contracts/policies).
4. **Default phase**: route enterprise DI through pointer retrieval with fallback to baseline.

## Metrics

- Retrieval precision@k on annotation set.
- Citation correctness (% answer spans grounded in correct region IDs).
- Table/form query success rate.
- Context compactness (tokens per successful answer).
- Latency budget for graph walk and ranking.
