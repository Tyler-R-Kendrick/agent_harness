# Autodata / Agentic Self-Instruct (Meta RAM, 2026)

- Paper/blog title: **Autodata: an automatic data scientist to create high quality data**
- Canonical link: https://facebookresearch.github.io/RAM/blogs/autodata/
- News intake link: https://www.marktechpost.com/2026/05/01/meta-introduces-autodata-an-agentic-framework-that-turns-ai-models-into-autonomous-data-scientists-for-high-quality-training-data-creation/
- Published: 2026-05-01 (blog publication date)

## What this work proposes

Autodata frames data creation itself as an agentic optimization problem: a main orchestrator agent iteratively generates examples, evaluates them with objective gates, analyzes failures, and updates the generation recipe. Its first instantiation (Agentic Self-Instruct) targets examples where a strong solver succeeds but a weaker solver fails, producing higher-separation training/eval data.

## Extracted capability to implement

### Capability name

**Weak-vs-Strong Separation Data Loop (WSSDL)**

### Capability definition

A deterministic orchestration loop that:

1. Generates context/question/answer/rubric candidates from grounded source text.
2. Runs quality gates (leakage + rubric format + specificity).
3. Scores weak/strong solver outputs.
4. Accepts samples only if quality and solver-gap thresholds pass.
5. Feeds structured failure insights back into the next generation round.

### Why it matters in our stack

- Creates reusable, verifiable training/eval artifacts for agent-browser research runs.
- Converts extra inference-time orchestration into higher-value supervised/RL data.
- Gives a reproducible, typed loop we can plug into eval workflows before model fine-tuning.

## Minimal algorithm sketch

1. Select a source document.
2. Challenger proposes `(context, question, referenceAnswer, rubric)`.
3. Quality verifier checks for context leak, rubric schema validity, and paper specificity.
4. If quality fails, produce targeted feedback and retry.
5. If quality passes, run weak and strong solvers for `k` attempts.
6. Judge rubric-scores each attempt and aggregate.
7. Accept sample if `weak <= weakMax` and `(strong - weak) >= minGap`.
8. Persist accepted sample + trajectory telemetry.

## Deliverables in this folder

- `reference-architecture.md` — system design + integration plan for this capability.
- `experiments/experiment-01-wssdl-spec.md` — first experiment plan.
- `experiments/experiment-01-wssdl-scaffold.ts` — TypeScript reference scaffold.
