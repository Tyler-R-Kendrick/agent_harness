# Reference Architecture — ADAS-style Harness Archive with Lineage Sampling

## Objective

Turn harness evolution from in-place mutation into append-only, content-addressed search: every generated harness definition is archived with scores and lineage, and new candidates are always children of sampled parents, keeping the whole search replayable and auditable.

## Components

1. **GenomeCodec**
   - Canonicalizes a harness definition to stable text and derives its content-hash id.
2. **HarnessArchive**
   - Append-only, content-addressed store of genomes (id, parentId, definition, summary, scores); insert dedupes on id.
3. **GenomeEvaluator**
   - Runs a fixed eval suite against a candidate definition and records quality and cost scores.
4. **NoveltyScorer**
   - Measures a genome's distance from the rest of the archive (feature/word overlap) to reward exploration.
5. **ParentSampler**
   - Seeded roulette selection weighted by combined score AND novelty; never returns nothing once seeded.
6. **MetaMutator**
   - Produces a child definition from a parent; in production a meta agent writing code, in experiments deterministic mutation snippets.
7. **LineageReporter**
   - Walks parentId chains to explain how any genome was derived.

## Data flow

1. The incumbent harness (from `agent-browser/src/services/harnessEvolution.ts`) is encoded, evaluated, and inserted as the root genome.
2. ParentSampler draws a parent using score + novelty weights.
3. MetaMutator emits a child definition; GenomeCodec hashes it.
4. Duplicate ids are dropped at insert; new ids are evaluated by GenomeEvaluator.
5. The scored child is inserted with its parentId; the parent is never modified.
6. After the budget, LineageReporter emits the best genome's ancestry for review and promotion.

## Validation and safety gates

- Insertions are append-only; any attempt to overwrite an existing id is rejected.
- Child definitions must pass schema/policy validation before evaluation.
- Evaluation runs in a sandboxed suite; archived genomes are inert data until explicitly promoted.
- Promotion requires a human-reviewable lineage report, not just a top score.

## Rollout policy

- Phase 1: archive-only — record genomes and scores for existing evolution runs without changing selection.
- Phase 2: enable lineage sampling for candidate generation in offline evals.
- Phase 3: allow promotion of archived genomes to shadow, then active, behind the metric gates below.

## Metrics

- Best archived score versus incumbent harness.
- Archive diversity (mean pairwise novelty).
- Dedupe rate (duplicate candidates per 100 mutations).
- Lineage depth of the best genome.
- Reproducibility: identical seed yields identical archive contents.
