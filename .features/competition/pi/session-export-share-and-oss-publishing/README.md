# Session Export Share And OSS Publishing

- Harness: Pi
- Sourced: 2026-04-30

## What it is
Pi supports exporting sessions, sharing them through private GitHub gists, and publicly publishing open-source work sessions to Hugging Face as a way to improve agent tooling on real-world traces.

## Evidence
- Official coding-agent README: [packages/coding-agent/README.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md)
- First-party details:
  - `/export` writes a session to HTML
  - `/share` uploads a private GitHub gist and returns a shareable HTML link
  - the README includes a dedicated "Share your OSS coding agent sessions" section and points users to `badlogic/pi-share-hf` plus a public Hugging Face dataset of the maintainer's own sessions
- Latest development checkpoint:
  - recent release notes include fixes around exported HTML escaping and rendering, which shows that share/export artifacts are treated as a product surface rather than a peripheral utility

## Product signal
Pi is unusually open about turning real coding sessions into portable artifacts, both for collaboration and for improving future agent systems with non-toy execution data.
