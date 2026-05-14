---
name: deep-research-harness
description: ARIS-inspired deep research workflow with adversarial executor/reviewer loops, persistent memory, and claim-evidence assurance checks.
---

# Deep Research Harness (ARIS-Inspired)

## Core UX Flow

1. **Plan**: turn user question into research objectives, assumptions, and falsifiable claims.
2. **Execute**: run an executor model to gather evidence, run tools, and draft findings.
3. **Adversarial Review**: route artifacts to a reviewer model from a different model family.
4. **Assure**: verify integrity, map results-to-claims, and audit unsupported or overclaimed text.
5. **Polish**: output publication-grade report plus machine-readable claim ledger.

## Commands

- `DeepResearch.start(topic, constraints)`
- `DeepResearch.review(artifactPath)`
- `DeepResearch.audit(reportPath, ledgerPath)`
- `DeepResearch.revise(reportPath, reviewerFeedbackPath)`

## Evidence Contract

Every substantive claim must include:

- claim_id
- natural-language claim text
- evidence artifact IDs
- source URLs or dataset provenance
- confidence grade
- reviewer verdict (`supported`, `partially-supported`, `unsupported`)

## Output Files

- `.research/wiki/*.md` persistent notes and source summaries.
- `.research/claim-ledger.jsonl` append-only claim log.
- `.research/reports/final-report.md` user-facing deliverable.
- `.research/reports/audit-report.md` assurance findings.
