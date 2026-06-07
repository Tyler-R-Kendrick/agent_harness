# Jira Claim Leases And Comment Marker Upserts

- Harness: OpenAI Symphony
- Sourced: 2026-06-07

## What it is
Symphony is extending its lease model into Jira so tracker-backed orchestration can recover durable worker ownership without creating unbounded heartbeat-comment spam.

## Evidence
- Open PR: [#83 feat(jira): add claim lease support](https://github.com/openai/symphony/pull/83)
- Related PR: [#82 Add Symphony claim lease heartbeat recovery](https://github.com/openai/symphony/pull/82)
- First-party details:
  - PR #83 adds a Jira tracker adapter for active issue fetches, comment reads, and state transitions
  - Jira claim lease markers are parsed from comments into normalized issue data used by the scheduler
  - existing marker comments are edited in place before creating new ones, which avoids unbounded comment growth from lease heartbeats
  - dispatch and retry recovery skip unexpired external leases and can hand off expired leases safely
  - the PR documents Jira tracker configuration and claim lease behavior in both the README and SPEC
- Latest development checkpoint:
  - on May 29, 2026, OpenAI opened PR #83 to turn claim leases from a Linear-only orchestration trick into a tracker-portable control-plane contract

## Product signal
Symphony is treating the issue tracker as part of the runtime state machine, not just the intake queue. The Jira work suggests mature harnesses will need portable lease semantics across trackers so mixed-tool teams can adopt the same orchestration safety model.
