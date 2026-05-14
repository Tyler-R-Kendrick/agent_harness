# Reference Architecture: Proxy Pointer Grounded Retrieval (PPGR)

## Goal

Implement multimodal-grounded answers without multimodal embeddings by combining text retrieval with structural pointer expansion.

## Architecture overview

```text
┌──────────────────────────────────────────────────────────┐
│ Document Ingestion                                       │
│ - PDF/HTML parser                                        │
│ - heading/section detection                              │
│ - figure/table extraction + OCR metadata                 │
└───────────────┬──────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────┐
│ Structure Graph Builder                                  │
│ Nodes: section, paragraph, figure, table                 │
│ Edges: contains, references, near, caption-of            │
└───────────────┬──────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────┐
│ Text Retrieval Layer                                     │
│ - BM25 / sparse retrieval                                │
│ - optional text embedding rerank                         │
└───────────────┬──────────────────────────────────────────┘
                │ top-K text nodes
┌───────────────▼──────────────────────────────────────────┐
│ Pointer Expansion Layer                                  │
│ - traverse structural edges                              │
│ - create multimodal pointer bundles                      │
│ - score, dedupe, cap budget                              │
└───────────────┬──────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────┐
│ Answer Composer                                          │
│ - builds grounded prompt                                 │
│ - cites text + figure/table pointers                     │
│ - returns citation map for UI rendering                  │
└──────────────────────────────────────────────────────────┘
```

## Components

### 1) Document Ingestion

- Produces normalized text chunks and artifact metadata (`assetUri`, `page`, `bbox`, caption).
- Emits stable IDs for all nodes.

### 2) Structure Graph Builder

- Builds adjacency map to support deterministic traversal.
- Stores edge type weights (e.g., `references` > `near`).

### 3) Text Retrieval Layer

- First pass: lexical retrieval on chunk text.
- Optional second pass: text-only semantic reranking.
- No multimodal embedding vectors are required.

### 4) Pointer Expansion Layer

- For each retrieved text node, traverse `contains/references/near` edges.
- Emit a pointer bundle with relevance score contributions:
  - retrieval score,
  - edge-type prior,
  - caption/query overlap.

### 5) Answer Composer

- Produces model input with explicit evidence blocks and asset pointer metadata.
- Generates response object with pointer references suitable for agent-browser citation panels.

## Safety and validation gates

- Reject pointers missing resolvable assets.
- Enforce max pointer budget to avoid prompt flooding.
- Require at least one textual evidence span for each returned answer claim.

## Rollout policy

1. Shadow mode: run PPGR alongside current retrieval and compare offline metrics.
2. Canary: route small traffic slice to PPGR for evaluation.
3. Gradual rollout gated by grounded-answer precision and citation validity.

## Metrics

- Grounded answer precision (claim supported by returned pointer set).
- Citation validity rate (pointer resolves to viewable artifact).
- Retrieval latency p50/p95.
- Prompt token overhead vs text-only RAG.
- Pointer diversity (unique figures/tables used when relevant).
