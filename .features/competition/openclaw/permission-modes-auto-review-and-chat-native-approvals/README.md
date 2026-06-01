# Permission Modes Auto Review And Chat Native Approvals

- Harness: OpenClaw
- Sourced: 2026-06-01

## What it is
OpenClaw now treats host-exec approval policy as a first-class product surface: one normalized `tools.exec.mode` knob decides whether commands are denied, allowlisted, auto-reviewed, or escalated to humans, while Codex-backed runs inherit the same contract.

## Evidence
- Official docs: [Permission modes](https://docs.openclaw.ai/tools/permission-modes)
- Official docs: [Exec tool](https://docs.openclaw.ai/tools/exec)
- Official docs: [Exec approvals](https://docs.openclaw.ai/tools/exec-approvals)
- Official product notes: [OpenClaw](https://openclaw.ai/)
- First-party details:
  - `tools.exec.mode` is the normalized policy surface with `deny`, `allowlist`, `ask`, `auto`, and `full`
  - `auto` runs deterministic allowlist matches directly, then uses OpenClaw's native auto reviewer before falling back to a human approval route for misses
  - the docs separate `tools.exec.mode` from `tools.exec.host=auto`, which means routing and approval posture are controlled independently
  - native Codex app-server sessions map `auto` mode to Guardian-style settings like `approvalPolicy=on-request`, `approvalsReviewer=auto_review`, and `sandbox=workspace-write`
  - host approvals remain dual-layered: OpenClaw config and `~/.openclaw/exec-approvals.json` both participate, with the stricter result winning
  - inline interpreter eval forms such as `python -c` and `node -e` can be forced back into explicit approval-only handling with `tools.exec.strictInlineEval`
  - when approvals are required, the exec tool returns `approval-pending` and the runtime emits explicit lifecycle events for running and finished commands instead of hiding approval state
- Latest development checkpoint:
  - the May 31, 2026 product notes moved OpenClaw away from plain YOLO host exec toward an opt-in auto-review posture that keeps policy first, gives low-risk misses a machine review pass, and only then escalates to humans

## Product signal
OpenClaw is turning shell access into a governed workflow instead of a binary safe versus unsafe toggle. The interesting move is the policy ladder: allowlists first, native reviewer second, human approval third, with backend-specific runtimes like Codex normalized under the same contract.
