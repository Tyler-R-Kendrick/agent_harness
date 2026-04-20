---
name: create-agent-eval
description: "Create an AgentEvals-style eval suite for a named agent under .agents/<agent-name>/.evals/. Use this whenever the user asks for an eval, regression suite, benchmark, or repeatable acceptance test for a workspace agent. Prefer it even when the user asks for a smoke test or acceptance check without naming AgentEvals directly."
license: MIT
metadata:
  version: "1.1.0"
---

# Create Agent Eval

Use this skill to create a compact eval suite beside a workspace agent without improvising the YAML structure.

## Steps

1. Capture the eval objective, user-facing success criteria, and likely failure modes.
2. Normalize the target agent name and eval file name to lowercase kebab-case.
3. Use `scripts/scaffold-agent-eval.ts` as the deterministic source of truth for the output path and YAML skeleton.
4. Fill the generated scaffold with concrete cases and assertions that are easy to verify and hard to misread.

## Rules

- Create eval suites under `.agents/<agent-name>/.evals/`.
- Use one YAML file per eval suite.
- Prefer short case descriptions, stable ids, and objective assertions.

## References

- Read [references/eval-schema.md](references/eval-schema.md) for the canonical YAML shape and naming conventions.
- Read [references/assertion-patterns.md](references/assertion-patterns.md) when choosing assertion types and writing unambiguous cases.

## Deterministic output

`scripts/scaffold-agent-eval.ts` defines the normalized output path and starter YAML. Use it whenever the request is mostly structural so your effort goes into the actual cases instead of retyping the boilerplate.