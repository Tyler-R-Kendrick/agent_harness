# ALDRIFT (Google Research, 2026)

- Paper/topic: **ALDRIFT: AI answers that do more than sound plausible**
- Canonical discussion link: https://www.searchenginejournal.com/google-researchs-aldrift-ai-answers-that-do-more-than-sound-plausible/574754/
- Publication context date: 2026-05-13 (article publish date shown by SEJ)

## What this work proposes

ALDRIFT focuses on closing the gap between:

1. **Plausible language quality** (answers that sound correct), and
2. **Operational usefulness** (answers that remain correct, grounded, and actionable under real interaction drift).

The practical framing is that answer systems degrade when query framing, follow-up turns, or retrieval context shift over time. The remedy is to continuously stress, diagnose, and adapt answer behavior against these drift patterns.

## Extracted capability to implement

### Capability name

**Drift-Aware Answer Reliability Loop (DARL)**

### Capability definition

A runtime loop that:

- detects conversational or retrieval drift,
- adjusts grounding/verification policy before finalizing responses, and
- logs measurable reliability outcomes for online adaptation.

### Why it matters in our stack

- Agent-browser style flows are long-horizon and multi-turn, which makes drift accumulation likely.
- Reliability controls should be first-class in the answer path, not post-hoc QA.
- The mechanism fits typed, modular TypeScript runtimes and can be integrated as a policy layer.

## Minimal algorithm sketch

1. Classify incoming turn and retrieval context for drift severity.
2. Select answer policy by severity (normal, constrained, or high-verification).
3. Generate candidate answer with citations/evidence handles.
4. Verify candidate against policy gates (coverage, contradiction, uncertainty disclosure).
5. If gate fails, regenerate with stricter policy or explicit abstention.
6. Persist telemetry for later policy tuning.

## Deliverables in this folder

- `reference-architecture.md` — integration plan for drift-aware answer reliability.
- `experiments/experiment-01-drift-loop.md` — experiment design and acceptance criteria.
- `experiments/experiment-01-drift-loop.ts` — TypeScript scaffold of the runtime policy loop.
