# ADR: Sandbox and Policy — Portable YAML Policy over Existing Adapters

## Status
Proposed

## Decision
Keep `lib/agent-sandbox` (iframe and WebContainer adapters, sandbox protocol)
as the browser-tier execution sandbox. Adopt an NVIDIA OpenShell-style
declarative YAML policy document as the portable policy contract: one policy
artifact describing filesystem, network, process-execution, and
inference-routing permissions, compiled to whatever enforcement the host
tier provides.

## Contract
- Policy document (YAML): scopes for filesystem paths, network hosts,
  process execution, tool allowlists, and model/inference routing; versioned
  and attached to the sub-harness descriptor
  (`2026-07-02-meta-harness-runtime.md`).
- Browser tier: policy compiles to existing adapter configuration —
  `SandboxedExecutionService` (`agent-browser/src/sandbox/service.ts`),
  iframe permissions, WebContainer mounts, and the just-bash isolated
  in-memory filesystem.
- Server tier (future): the same policy compiles to OpenShell kernel-level
  enforcement (seccomp, Landlock, network namespaces) for `agent-daemon`
  or remote workers, per `docs/worker-sandbox-provider-architecture.md`.
- Plugin permissions (`agent-harness.plugin.json` `permissions`) map into
  policy scopes; a plugin cannot exceed its manifest grant.

## Rollout phases
1. **Phase 0 (shadow):** policies authored and validated for existing
   sandbox flows; enforcement stays as-is; divergence between policy and
   actual behavior is logged.
2. **Phase 1 (opt-in):** policy-compiled configuration drives the browser
   sandbox adapters for opted-in tools.
3. **Phase 2 (core-default):** every tool-execution surface runs under a
   policy document; server tiers enforce the same artifact natively.

## Migration notes
- The existing feature gate `VITE_SECURE_BROWSER_SANDBOX_EXEC` becomes a
  policy field rather than an environment toggle.
- Policy documents are intent-DSL-adjacent data artifacts: token-efficient,
  diffable, and eval-gateable like other harness text.
