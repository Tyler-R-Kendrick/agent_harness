# PPGR rollout note (LocalWebResearch)

Date: 2026-05-14

## Goal
Compare the current LocalWebResearch retrieval ranking against PPGR (Pointer-Provenance Grounded Ranking) on deterministic fixtures before any default-strategy change.

## Eval path
- Fixtures live in `agent-browser/evals/local-web-research-retrieval/fixtures/cases.json`.
- Eval runner test: `agent-browser/evals/local-web-research-retrieval/localWebResearchRetrieval.eval.test.ts`.
- Both baseline and PPGR run against identical extracted-page inputs.

## Metrics logged/asserted
- Grounded precision proxy: fraction of top ranked chunks whose normalized URL is expected.
- Citation validity: citations must remain valid HTTP pointers.
- Latency: PPGR cannot regress beyond configured bound.
- Token overhead proxy: PPGR evidence token count ratio is bounded.

## Rollout gate
PPGR stays opt-in while `enablePpgrRetrievalEval` is false and baseline remains default in runtime calls.
Promote PPGR only after canary runs consistently satisfy:
1. citation validity >= baseline
2. latency regression <= bound
3. token overhead ratio <= bound
4. grounded precision proxy non-regressing in canary slices
