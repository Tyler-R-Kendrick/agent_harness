# Deep Research Harness IDE Plugin

This plugin implements a **deep research extension** inspired by ARIS (arXiv:2605.03042), adapting its core principles for IDE-native research workflows:

- cross-model **executor/reviewer adversarial collaboration**
- **persistent research wiki** for long-horizon memory
- **claim-evidence assurance pipeline** to prevent unsupported success
- deterministic report + audit outputs for reproducible review

## Architecture Mapping (Paper → Plugin)

1. **Execution layer** → `skills/deep-research-harness/SKILL.md` + MCP server scaffold.
2. **Orchestration layer** → panel views + quick actions in `apps/deep-research-panel.json`.
3. **Assurance layer** → `scripts/assert-claim-coverage.mjs` gate and claim ledger contract.

## Local bootstrap

- On session start, `scripts/init-research-workspace.mjs` ensures `.research/*` paths exist.
- Before final answer, `scripts/assert-claim-coverage.mjs` blocks completion when claims lack mapped evidence.
