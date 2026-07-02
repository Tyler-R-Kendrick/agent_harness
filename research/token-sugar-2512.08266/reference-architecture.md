# Reference Architecture — Token-Sugar-style Reversible Intent Minifier

## Objective

Provide a deterministic, fully reversible minification layer for intent-DSL documents so models read and write a compact vocabulary while the runtime can always restore the canonical text bit-for-bit.

## Components

1. **Canonicalizer**
   - Normalizes an intent document into a whitespace-stable token sequence (canonical form per `research/anka-2512.23214`).
2. **TokenTableBuilder**
   - Assigns short forms to eligible long tokens in first-appearance order; fully deterministic.
3. **Minifier**
   - Emits the `.min` stream from the canonical tokens and the table.
4. **MapWriter**
   - Produces the `<name>.min.map` sidecar: version, named-value token table, positional entries.
5. **Expander**
   - Replays the positional mapping against the table to restore canonical text.
6. **RoundTripVerifier**
   - Machine-checks `expand(minify(x)) === canonicalize(x)` for every document.
7. **SavingsAccountant**
   - Reports character and approximate token savings to `lib/prompt-budget`.

## Data flow

1. Canonicalizer receives the intent document and emits canonical tokens.
2. TokenTableBuilder scans tokens and fixes the short-form table.
3. Minifier writes `<name>.min`; MapWriter writes `<name>.min.map`.
4. Downstream, the minified vocabulary becomes the grammar's terminal set for `harness-core/src/constrainedDecoding.ts`, so the model decodes short forms only.
5. Expander reconstructs canonical text for validation, display, and storage.
6. Verifier gates every artifact pair; Accountant logs savings.

## Validation and safety gates

- A `.min`/`.min.map` pair is valid only if the round-trip invariant holds exactly.
- Sidecar version mismatches are rejected; there is no best-effort expansion.
- Positional entries must cover every minified token; gaps fail closed.
- Expanded output must re-parse under the canonical intent grammar before use.

## Rollout policy

- Start in shadow mode: minify/expand alongside the canonical pipeline and compare, without serving `.min` artifacts.
- Graduate to serving `.min` to models for read-only contexts once invariant failures are zero over a fixture corpus.
- Enable model-written `.min` (with constrained decoding over the short-form vocabulary) only after the grammar terminal set is gated.

## Metrics

- Round-trip invariant pass rate (must be 100%).
- Character and approximate token savings per document.
- Table size versus document length (compression overhead).
- Expansion failures caught by the fail-closed gate.
- Downstream parse rate of expanded documents.
