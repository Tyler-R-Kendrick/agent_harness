# Proxy-Pointer RAG (Towards Data Science, 2026)

- Paper/article: **Proxy-Pointer RAG: Multimodal Answers Without Multimodal Embeddings**
- Link: https://towardsdatascience.com/proxy-pointer-rag-multimodal-answers-without-multimodal-embeddings/
- Published: 2026-04-26 (Towards Data Science canonical post date)

## What this paper proposes

Proxy-Pointer RAG proposes a **structure-aware retrieval pipeline** that returns multimodal evidence (text spans, tables, and images) without requiring multimodal embedding models.

Core idea:

1. Build retrieval around document structure (sections, headings, page anchors, figure/table references).
2. Use text-centric retrieval to find likely answer zones.
3. Return **pointers** to original multimodal artifacts rather than embedding every artifact in a shared vector space.
4. Let the answer generator ground explanations on those pointers and attached artifacts.

## Extracted capability to implement

### Capability name

**Proxy Pointer Grounded Retrieval (PPGR)**

### Capability definition

A retrieval subsystem that:

- ranks candidate text chunks with lightweight lexical + semantic text retrieval,
- expands candidates through structural graph links (`section -> paragraph -> figure/table`),
- emits deterministic pointer bundles (`docId`, `page`, `bbox`, `assetUri`, `caption`) for downstream grounded answer generation.

### Why it matters for our stack

- Avoids mandatory multimodal embedding infra and associated indexing cost.
- Preserves provenance for Agent Browser citation UX (exact page/asset pointer).
- Fits existing TypeScript-first runtime and can be added as a retrieval strategy beside vector RAG.

## Minimal algorithm sketch

1. Parse document into a structural graph.
2. Index text nodes only (BM25 + optional text embedding reranker).
3. Retrieve top-K text nodes for a query.
4. Expand each node by structural edges to linked figures/tables.
5. Score and deduplicate multimodal pointers.
6. Return answer context packet containing text evidence + asset pointers.

## Deliverables in this folder

- `reference-architecture.md` — PPGR architecture mapped to agent-browser components.
- `experiments/experiment-01-proxy-pointer.md` — runnable experiment protocol and acceptance criteria.
- `experiments/experiment-01-proxy-pointer.ts` — TypeScript scaffold implementing a deterministic PPGR loop.
