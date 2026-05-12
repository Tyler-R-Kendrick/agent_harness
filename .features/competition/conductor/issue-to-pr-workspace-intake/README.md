# Issue To PR Workspace Intake

- Harness: Conductor
- Sourced: 2026-05-12

## What it is
Conductor has a guided issue-to-PR workflow where the starting unit is a tracked issue and the finish state is a reviewed, validated branch ready for pull-request creation and merge.

## Evidence
- Official docs: [Issue to PR](https://www.conductor.build/docs/guides/issue-to-pr)
- Official docs: [Workspaces and branches](https://www.conductor.build/docs/concepts/workspaces-and-branches)
- First-party details:
  - users can open a workspace directly from an issue
  - the documented flow moves through implementation, diff review, checks, PR creation, and archive
  - Conductor frames issue-backed workspace creation as a standard operational path
- Latest development checkpoint:
  - the current guide still treats issue-native delivery as a primary workflow, which aligns the harness tightly to real engineering work management

## Product signal
This is another indicator that coding harnesses are becoming workflow engines around issue systems and pull requests, not just better chat UIs for code generation.
