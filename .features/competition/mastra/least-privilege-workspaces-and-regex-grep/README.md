# Least-Privilege Workspaces And Regex Grep

- Harness: Mastra
- Sourced: 2026-05-01

## What it is
Mastra is upgrading workspace tooling around safer filesystem boundaries and better repository search, including allowlisted external paths, glob-aware indexing, and a built-in regex grep tool.

## Evidence
- Official changelog: [Mastra Changelog 2026-02-19](https://mastra.ai/blog/changelog-2026-02-19)
- First-party details:
  - `LocalFilesystem` now supports `allowedPaths`, which lets teams grant access to specific directories outside the workspace base path without disabling containment.
  - Workspaces support glob patterns for file listing, automatic BM25 indexing, and skills discovery.
  - Mastra added `mastra_workspace_grep` as a regex search tool for exact pattern matching across files when semantic search is the wrong fit.
- Latest development checkpoint:
  - the February 19, 2026 release frames these changes as production-focused workspace ergonomics for larger repos and stricter runtime safety

## Product signal
Mastra is treating the workspace as a governed execution boundary, not a casual file browser. That is a useful signal for browser-capable agent harnesses that need stronger policy control without losing developer-grade repo search.
