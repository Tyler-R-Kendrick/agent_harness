# Semantic Codebase Indexing With Qdrant

- Harness: Roo Code
- Sourced: 2026-05-09

## What it is
Roo can build a semantic code index over a repository so the agent can search by meaning instead of by exact string matches.

## Evidence
- Official docs: [Codebase Indexing](https://docs.roocode.com/features/codebase-indexing)
- First-party details:
  - Roo parses source with Tree-sitter to identify semantic blocks such as functions, classes, and methods
  - it embeds those blocks and stores the vectors in Qdrant
  - Roo then exposes a `codebase_search` tool for natural-language code discovery
  - the docs explicitly pitch a zero-cost setup using free-tier Qdrant or Docker Qdrant plus free Gemini embeddings
- Latest development checkpoint:
  - Roo's docs frame semantic indexing as a mainstream setup path rather than an enterprise-only add-on, which lowers the barrier to repo-grounded agent work

## Product signal
Roo is turning repo search into a retrieval layer the agent can call directly, not just a better file-open shortcut for humans.
