---
name: skill-optimizer
description: "Optimize an existing agent skill by running /sensei --gepa, tightening agentskills.io compliance, moving bulky guidance out of SKILL.md into references/, and creating agentevals.io-style evals. Use this whenever the user asks to improve a skill's triggering, shrink an overgrown SKILL.md, refactor a skill into progressive disclosure, or add repeatable evals for a skill under skills/ or .agents/skills/."
license: MIT
metadata:
  author: agent_harness
   version: "1.1.0"
compatibility: "Requires an editable skill bundle plus shell access for /sensei --gepa, git, node, and python when evals or deterministic scripts need to run."
---

# Skill Optimizer

Use this skill to improve an existing agent skill without losing the original intent or public identity.

## Core goals

- Improve the target skill with `/sensei --gepa` before doing large manual rewrites.
- Keep the main `SKILL.md` compact, triggerable, and focused on how the skill should be used.
- Move long examples, schemas, scoring rubrics, and extended recipes into `references/` so they load on demand.
- Create `evals/evals.json` in an AgentEvals-style shape so the skill has repeatable evaluation coverage.
- When part of the workflow is deterministic, replace repeated free-form reasoning with small TypeScript scripts in the optimized skill's own `./scripts/` folder, developed through red/green TDD.

## Workflow

1. Resolve the canonical skill path.
   - Accept a target under `skills/<name>/` or `.agents/skills/<name>/`.
   - If the incoming path is a symlink, edit the canonical bundle rather than the compatibility link.
   - Preserve the existing skill name, folder name, and user-facing purpose unless the user explicitly asks to rename them.
   - Use `scripts/resolve-optimization-plan.ts` as the deterministic source of truth for canonical path resolution, expected bundle outputs, and the first-pass optimization plan.
2. Audit the target before changing it.
   - Check frontmatter shape, trigger clarity, line count, and whether the body has turned into a README instead of an activation guide.
   - Identify content that belongs in `references/` rather than the main `SKILL.md`.
   - Identify deterministic work that would be safer or faster as executable code.
3. Run `/sensei --gepa` on the target skill first.
   - Use GEPA mode to improve frontmatter and routing before manual restructuring.
   - Review the proposed changes instead of accepting them blindly, especially if they weaken the user's intent or remove important disambiguation language.
4. Refactor for progressive disclosure.
   - Keep in `SKILL.md`: frontmatter, when to use the skill, the short workflow, the important constraints, and pointers to reference files.
   - Move to `references/`: long examples, schemas, benchmark guidance, migration recipes, scoring details, or troubleshooting that would dilute the main prompt.
   - Add clear references from `SKILL.md` so the model knows when to read deeper material.
5. Add or update AgentEvals-style coverage.
   - Create `evals/evals.json` with realistic prompts, expected outcomes, optional files, and concrete expectations.
   - Prefer prompts that test both core success paths and near-miss cases where the skill might overtrigger or undertrigger.
   - Keep evals realistic enough that a model would actually consult the skill instead of handling the task with generic tools alone.
6. Convert deterministic work into TypeScript.
   - When the workflow includes repeated parsing, validation, packaging, migration, reporting, or structural transforms, write a script in the optimized skill's `./scripts/` folder instead of describing the procedure vaguely.
   - Start with a failing test, implement the smallest passing script, then refactor while keeping tests green.
   - Keep scripts composable, documented, callable from the skill instructions, and stored beside the skill they support rather than in some shared unrelated location.
7. Validate the result.
   - Re-run the relevant sensei checks and any skill-specific tests.
   - Verify that reference links resolve and that the main `SKILL.md` is materially smaller and easier to trigger.
   - Summarize what changed in the skill, what moved into `references/`, and what deterministic helpers were added.

## Deterministic work rule

If you notice yourself describing a mechanical series of steps that can be checked or reproduced, stop and turn it into a TypeScript script with tests in the optimized skill's `./scripts/` folder. Read [references/deterministic-typescript.md](references/deterministic-typescript.md) before implementing it.

## Deterministic workflow

`scripts/resolve-optimization-plan.ts` defines the canonical path resolution, the sparse-vs-reference section classification, and the expected output paths for `references/`, `evals/`, and `scripts/`. Use it before improvising the optimization plan by hand.

## Reference map

- Read [references/agentskills-checklist.md](references/agentskills-checklist.md) when checking spec compliance and frontmatter shape.
- Read [references/agentevals-checklist.md](references/agentevals-checklist.md) when creating or revising `evals/evals.json` and benchmark artifacts.
- Read [references/progressive-disclosure.md](references/progressive-disclosure.md) when deciding what stays in `SKILL.md` versus what moves into `references/`.
- Read [references/deterministic-typescript.md](references/deterministic-typescript.md) when the optimization should produce executable TypeScript helpers.

## Expected outputs

- An updated skill bundle that still triggers for the original use case.
- A leaner `SKILL.md` plus supplemental docs in `references/`.
- An `evals/evals.json` file that exercises the optimized behavior.
- TypeScript scripts and tests in the optimized skill's `./scripts/` folder for any deterministic workloads discovered during optimization.

## Example requests

Input: "Use /sensei --gepa on skills/release-manager, keep the skill name, shrink the huge SKILL.md, move the long rollout examples into references, and add evals."

Output: An optimized `skills/release-manager/` bundle with a compact `SKILL.md`, new `references/` docs, and `evals/evals.json`.

Input: "Tighten .agents/skills/pdf-cleanup so it stops undertriggering, and script the markdown-to-json validation instead of repeating it manually."

Output: The canonical skill bundle is updated, `/sensei --gepa` is applied, a deterministic TypeScript validator is added under the optimized skill's `./scripts/` folder with tests, and eval coverage reflects the new behavior.