# SkillOpt (arXiv:2605.23904)

- Paper: **SkillOpt: Executive Strategy for Self-Evolving Agent Skills**
- Authors: Yifan Yang et al. (Microsoft Research + SJTU/Fudan/Tongji)
- Links: https://arxiv.org/abs/2605.23904, https://huggingface.co/papers/2605.23904
- Published: 2026-05 (arXiv); currently the top-trending HF Daily Paper in this space (~249 upvotes).

## What this paper proposes

SkillOpt treats a SKILL.md document (a 300-2,000-token procedural skill file in the Anthropic Agent Skills style) as a trainable parameter of a frozen agent. Instead of fine-tuning weights, the agent:

1. Rolls out the current skill document on training tasks.
2. Reflects on failures and proposes a bounded edit to the document.
3. Validates the edited document on held-out tasks.
4. Accepts the edit only if held-out performance improves; otherwise the rejection (with its score delta) is fed back to the proposer to condition future proposals.
5. Emits a deployable `best_skill.md`.

The paper reports large gains across Codex, Claude Code, and direct-chat harnesses with zero deployment overhead — the optimized artifact is just a markdown file.

## Extracted capability to implement

### Capability name

**Eval-Gated Skill Document Optimization (EGSDO)**

### Capability definition

An optimization loop over a typed skill document: bounded diff proposals (one section replaced or appended, under length caps), validation-gated acceptance against a held-out task set, and a rejected-edit memory that biases which proposals are tried next.

### Why it matters in our stack

- Operates directly on this repo's canonical `skills/<name>/SKILL.md` + symlink convention (see AGENTS.md), so optimized skills deploy with no runtime changes.
- Positions SkillOpt as the optimizer over the skill artifacts introduced by `research/skillos-2605.06614` and `research/ctx2skill-2604.27660`.
- Optimized documents register and route through the existing `agent-browser/src/services/skillRegistry.ts` / `skillRouter.ts` surfaces.

## Minimal algorithm sketch

1. Load the current skill document as a typed list of sections.
2. Each iteration, propose one bounded edit (replace or append a single section, within length caps).
3. Skip proposals matching entries in the rejected-edit memory.
4. Score the candidate document on the held-out fixture task set.
5. If the score beats the best document, accept and update `bestDoc`; else record the rejection with its score delta.
6. After the budget, emit the best document plus the full optimization log.

## Deliverables in this folder

- `reference-architecture.md` — architecture for eval-gated skill document optimization in agent-browser style runtimes.
- `experiments/experiment-01-skill-doc-optimizer.md` — experiment design and acceptance criteria.
- `experiments/experiment-01-skill-doc-optimizer.ts` — TypeScript implementation scaffold.
