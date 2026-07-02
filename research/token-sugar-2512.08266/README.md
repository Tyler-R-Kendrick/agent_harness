---
type: research-packet
---

# Token Sugar (arXiv:2512.08266)

- Paper: **Token Sugar: Making Code Sweeter for LLMs**
- Links: https://arxiv.org/abs/2512.08266 / https://huggingface.co/papers/2512.08266
- Published: 2025-12 (per arXiv listing)

## What this paper proposes

Token Sugar introduces a deterministic, fully reversible token-efficient shorthand for code. Instead of asking the model to work with long identifiers and keywords, the system:

1. Maps long identifiers/keywords to short forms via a lookup table.
2. Lets the LLM read and write the compact form directly.
3. Restores the original text with a deterministic expander — no information is lost.

The paper reports substantial token-count reductions while preserving exact round-trip fidelity, so the shorthand is a transport encoding, not a lossy summary.

## Extracted capability to implement

### Capability name

**Reversible Intent Minifier (RIM)**

### Capability definition

`minify()`/`expand()` for intent-DSL documents producing `<name>.min` plus a `<name>.min.map` sidecar (named-value table + positional mapping), with a machine-checkable round-trip invariant `expand(minify(x)) === canonicalize(x)`.

### Why it matters in our stack

- Makes the repo's ".min.map" concept concrete: a versioned sidecar format with a token table and positional entries.
- Constrained decoding only needs the minified token vocabulary — the short forms become the grammar's terminal set in `harness-core/src/constrainedDecoding.ts`.
- `lib/prompt-budget` gets exact, deterministic token-savings accounting instead of estimates.
- The canonical form from the sibling packet `research/anka-2512.23214` is the input to the minifier, so canonicalization and minification compose.

## Minimal algorithm sketch

1. Canonicalize the intent document (whitespace-normalized token sequence).
2. Scan tokens in order; assign each eligible long token a short form on first appearance.
3. Emit the `.min` stream plus a `.min.map` sidecar (version, token table, positional entries).
4. Expand by replaying the positional mapping against the table.
5. Verify the invariant `expand(minify(x)) === canonicalize(x)` for every document.
6. Account savings deterministically (characters and approximate tokens saved).
7. Reject any document whose round-trip check fails before it reaches downstream consumers.

## Deliverables in this folder

- `reference-architecture.md` — architecture for integrating RIM in agent-browser style runtimes.
- `experiments/experiment-01-min-map-roundtrip.md` — experiment design and acceptance criteria.
- `experiments/experiment-01-min-map-roundtrip.ts` — TypeScript implementation scaffold.
