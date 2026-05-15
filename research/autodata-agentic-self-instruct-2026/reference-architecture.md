# Reference Architecture: Weak-vs-Strong Separation Data Loop

## 1) Components

- **OrchestratorAgent**: owns loop state, round budget, and acceptance policy.
- **ChallengerAgent**: produces candidate QA/rubric artifacts from a source document.
- **QualityVerifier**: enforces deterministic checks:
  - context leak prevention
  - schema-safe rubric format
  - source-specificity check
- **SolverRunner**:
  - `weakSolver` (baseline model)
  - `strongSolver` (teacher model)
  - repeated attempts for variance reduction
- **Judge**: rubric-based scoring per criterion and aggregate score.
- **TrajectoryStore**: append-only logs of rounds, failures, acceptance reasons.
- **InsightSynthesizer**: compiles failure motifs into structured challenger feedback.

## 2) Data flow

1. Input source doc enters orchestrator.
2. Challenger emits candidate sample.
3. QualityVerifier returns pass/fail + failure codes.
4. On pass, SolverRunner executes weak+strong attempts.
5. Judge scores attempts and computes aggregate weak/strong scores.
6. Acceptance gate evaluates thresholds.
7. Orchestrator either:
   - persists accepted sample, or
   - sends failure insights back to Challenger for the next round.

## 3) Safety and validation gates

- **Structural gate**: rubric must be parseable and weight-sane.
- **Leakage gate**: context cannot trivially reveal answer content.
- **Specificity gate**: question should require source-specific understanding.
- **Gap gate**: enforce minimum weak-vs-strong separation.
- **Budget gate**: terminate after `maxRounds` with explicit failure report.

## 4) Rollout policy in our stack

- **Stage A (offline simulation)**: deterministic mock implementations and synthetic docs.
- **Stage B (eval integration)**: replay loop over a fixed document subset with seeded randomization.
- **Stage C (model-backed)**: swap mocks for real model adapters under the same interfaces.
- **Stage D (meta-optimization)**: iterative edits to prompts/rules accepted only if validation metrics improve.

## 5) Metrics

- Acceptance rate per document.
- Median rounds-to-accept.
- Mean weak score, mean strong score, and separation gap.
- Quality failure distribution by code.
- Determinism checks across repeated seeded runs.
