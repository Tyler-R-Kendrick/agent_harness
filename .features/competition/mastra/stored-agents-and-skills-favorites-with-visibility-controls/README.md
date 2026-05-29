# Stored Agents And Skills Favorites With Visibility Controls

- Harness: Mastra
- Sourced: 2026-05-29

## What it is
Mastra now treats stored agents and skills as queryable catalog objects with favorite state, public versus private visibility, and ranking metadata instead of simple flat storage rows.

## Evidence
- Official releases: [mastra-ai/mastra releases](https://github.com/mastra-ai/mastra/releases)
- Official platform launch: [Announcing Mastra Platform](https://mastra.ai/blog/announcing-mastra-platform)
- First-party details:
  - the May 15, 2026 release notes add a `favorites` storage domain for agents and skills plus `visibility` and `favoriteCount` fields for filtering and ordering
  - the same release says favorites are implemented across multiple storage adapters, which turns the feature into a portable platform capability rather than a single database experiment
  - Mastra's platform direction already includes Agent Editor, versioned assets, datasets, experiments, and cloud-hosted Studio, so ranked stored agents and skills fit a broader shared control-plane catalog
- Latest development checkpoint:
  - the current release line positions stored agents and skills as team-visible assets with discovery and social ranking semantics

## Product signal
Mastra is moving agent and skill storage toward a governed internal marketplace. That matters because once teams accumulate many reusable workflows, discovery, visibility, and curation become product requirements rather than nice-to-have metadata.
