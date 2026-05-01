# Per User File Index Shards

- Harness: Space Agent
- Sourced: 2026-04-30

## What it is
Space Agent's latest release moved file and module discovery toward demand-loaded per-user shards so multi-user instances do not have to scan the whole app index at startup.

## Evidence
- Official releases: [agent0ai/space-agent releases](https://github.com/agent0ai/space-agent/releases)
- Official product site: [space-agent.ai login](https://space-agent.ai/login)
- First-party details:
  - the latest `v0.66` release says file and module APIs now demand-load the caller's L2 file-index shard
  - the same release says the system no longer scans all users on boot and instead scopes discovery and listing to relevant shards
  - release notes also call out a new `file_index_store` and related file-watch changes to manage shard lifecycle
  - the hosted product and README both emphasize guest and multi-user operation, so this scaling work supports a real surfaced product mode
- Latest development checkpoint:
  - this is the latest release as of April 30, 2026, so the product is actively investing in multi-user runtime scale and startup cost reduction

## Product signal
Space Agent is already optimizing for shared-instance operation, which is a strong sign that multi-user agent workspaces are part of its intended production posture.
