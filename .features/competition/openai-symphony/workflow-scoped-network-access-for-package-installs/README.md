# Workflow-Scoped Network Access For Package Installs

- Harness: OpenAI Symphony
- Sourced: 2026-05-17

## What it is
Symphony is making network access an explicit turn-level workflow setting so bootstrap steps like package installation or DNS-dependent external host resolution can be allowed without relaxing safer defaults globally.

## Evidence
- Open PR: [#65 Allow network access for package-installing workflow turns](https://github.com/openai/symphony/pull/65)
- First-party details:
  - PR #65 says package installs in Symphony-launched runs needed DNS and network access, but the workflow turn sandbox did not enable it
  - the proposed fix adds `networkAccess: true` to the workflow turn sandbox policy
  - the PR documents this knob for workflows that run package managers or resolve external hosts during setup
  - the rationale keeps safer implementation defaults unchanged and scopes the allowance to the checked-in workflow contract instead
- Latest development checkpoint:
  - on May 4, 2026, OpenAI proposed handling bootstrap network needs as a repo-owned workflow policy decision rather than burying them in ad hoc operator overrides

## Product signal
Symphony shows a strong design pattern for harness permissions: runtime escape hatches should live in versioned workflow policy with tight scope, not as invisible global defaults.
