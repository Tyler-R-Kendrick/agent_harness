# Codebase Semantic Indexing

- Harness: Kilo Code
- Sourced: 2026-05-07

## What it is
Kilo can build a semantic index of the codebase so agents search by meaning across functions, classes, and methods instead of only by filename or exact text.

## Evidence
- Official docs: [Codebase Indexing](https://kilo.ai/docs/customize/context/codebase-indexing)
- Official releases: [Kilo releases](https://github.com/Kilo-Org/kilocode/releases)
- First-party details:
  - the indexing docs say Kilo parses code with Tree-sitter, creates embeddings for semantic blocks, stores vectors, and exposes a `semantic_search` tool
  - natural-language queries like authentication or database handling are meant to resolve relevant code even when exact names are unknown
  - the feature is gated behind an experimental Semantic Indexing flag
  - the May 6, 2026 pre-release notes say Kilo now respects project-specific semantic indexing decisions instead of enabling indexing globally across workspaces
- Latest development checkpoint:
  - the early May 2026 change from global to project-specific indexing policy suggests Kilo is actively hardening semantic search for real multi-workspace use instead of treating it as a lab demo

## Product signal
Kilo is treating semantic retrieval as a harness capability with repo-level policy, which makes large-codebase discovery part of the runtime rather than an external add-on.