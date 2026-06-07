# Tracker Backed Claim Leases And Heartbeat Recovery

- Harness: OpenAI Symphony
- Sourced: 2026-06-07

## What it is
Symphony is adding durable claim leases so each issue can advertise which worker currently owns it, when that lease expires, and whether recovery should requeue the work instead of duplicating the run after a restart.

## Evidence
- Open PR: [#82 Add Symphony claim lease heartbeat recovery](https://github.com/openai/symphony/pull/82)
- First-party details:
  - PR #82 says Symphony now tracks claim lease state with worker id, workspace path, retry attempt, heartbeat timestamp, and expiry
  - the same PR publishes tracker comment markers for active, retrying, and blocked claim states
  - expired non-live leases are requeued so recovery can hand work back to the scheduler instead of assuming the old worker is still authoritative
  - the JSON API and LiveView dashboard surface lease state and expired recovery events for operators
  - the change adds focused orchestration and observability tests plus spec and README updates
- Latest development checkpoint:
  - on May 29, 2026, OpenAI opened PR #82 to make worker ownership durable across restarts and visible in the operator surfaces

## Product signal
Symphony is moving beyond in-memory dispatch claims and toward tracker-backed worker leases, which is the kind of coordination layer a multi-runner harness needs before it can recover safely from restarts, host loss, or overlapping schedulers.
