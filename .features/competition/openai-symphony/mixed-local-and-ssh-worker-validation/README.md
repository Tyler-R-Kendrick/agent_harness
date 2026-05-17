# Mixed Local And SSH Worker Validation

- Harness: OpenAI Symphony
- Sourced: 2026-05-17

## What it is
Symphony’s reference implementation now documents a live end-to-end test that exercises both local workers and SSH workers against real Linear and Codex app-server flows.

## Evidence
- Elixir reference docs: [elixir/README.md](https://github.com/openai/symphony/blob/main/elixir/README.md)
- First-party details:
  - the current Elixir README says `make e2e` runs two live scenarios: one with a local worker and one with SSH workers
  - when external SSH hosts are not supplied, the test starts disposable SSH workers with `docker compose` on localhost ports
  - the live test generates a temporary SSH keypair and mounts the host `~/.codex/auth.json` into each worker so the transport stays representative
  - the scenario creates temporary Linear resources, writes a temporary `WORKFLOW.md`, runs a real agent turn, verifies a workspace side effect, requires the agent to comment on and close the Linear issue, and then completes the temporary project
- Latest development checkpoint:
  - by May 2026, the reference implementation was no longer only documenting local orchestration but was explicitly proving transport parity across local and SSH worker execution

## Product signal
Symphony is treating remote-worker support as a practical operating mode that should be regression-tested end to end, which is stronger than simply claiming remote execution could exist in principle.
