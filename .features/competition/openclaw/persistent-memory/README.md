# Persistent Memory

- Harness: OpenClaw
- Sourced: 2026-05-20

## What it is
OpenClaw combines workspace bootstrap files with durable per-agent session stores, transcript projection, pruning, compaction, and cross-session recall tooling.

## Evidence
- Official docs: [Agent Runtime](https://docs.openclaw.ai/concepts/agent)
- Official docs: [Session Management](https://docs.openclaw.ai/concepts/session)
- First-party details:
  - OpenClaw injects workspace files such as `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `BOOTSTRAP.md`, `IDENTITY.md`, and `USER.md` into a new session context
  - session transcripts live at `~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl`, with store metadata in `sessions.json`
  - the session docs explicitly link pruning, compaction, and session tools as part of the memory surface
  - cross-session recall is exposed through bounded, sanitized session-history tooling rather than raw transcript dumping
- Latest development checkpoint:
  - the current runtime docs are much more explicit that OpenClaw memory is both file-backed and transcript-backed, and that session tooling now projects that state safely instead of treating transcripts as a blind append-only dump

## Product signal
OpenClaw treats memory as a layered product surface: editable prompt files for durable instructions, plus governed session history for operational recall.
