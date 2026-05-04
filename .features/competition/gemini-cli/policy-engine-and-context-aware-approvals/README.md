# Policy Engine And Context Aware Approvals

- Harness: Gemini CLI
- Sourced: 2026-05-04

## What it is
Gemini CLI ships a configurable policy engine that governs tool usage and approval behavior, giving the harness a structured safety layer instead of relying only on broad trust modes.

## Evidence
- Official docs: [Policy Engine](https://geminicli.com/docs/reference/policy-engine/)
- First-party details:
  - policies can control what the agent is allowed to do and when approvals are required
  - the docs frame policy as a reusable configuration surface rather than a one-off runtime prompt
  - policy can travel with extensions and project configuration, which turns safety posture into versioned harness behavior
- Latest development checkpoint:
  - the policy engine is documented as part of the current reference set, showing that governance is a stable product surface.

## Product signal
Gemini CLI is making runtime governance explicit and configurable. That fits the broader trend away from binary "full auto vs manual approve" modes toward policy-aware agent operations.
