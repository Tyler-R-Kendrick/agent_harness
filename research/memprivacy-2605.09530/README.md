# MemPrivacy (arXiv:2605.09530)

- Paper: **MemPrivacy: Privacy-Preserving Personalized Memory Management for Edge-Cloud Agents**
- Link: https://huggingface.co/papers/2605.09530
- Published: 2026-05-10 (per Hugging Face paper page)

## What this paper proposes

MemPrivacy introduces a privacy layer for edge-cloud agent memory pipelines that:

1. Detects privacy-sensitive spans locally on edge devices.
2. Replaces sensitive values with **typed placeholders** preserving semantic role.
3. Sends only placeholderized text to cloud memory systems.
4. Restores original values locally for user-visible outputs.

The core idea is to improve privacy protection without collapsing downstream memory utility (which often happens with naive `***` masking).

## Extracted capability to implement

### Capability name

**Typed Reversible Privacy Envelope (TRPE)**

### Capability definition

A deterministic middleware that performs typed reversible pseudonymization for conversation/memory payloads, controlled by a 4-level privacy policy (PL1–PL4), with local-only secret mapping and cloud-safe serialized events.

### Why it matters

- Reduces cloud exposure of raw PII/secrets.
- Preserves memory extraction/retrieval quality by retaining semantic categories.
- Fits existing agent-browser architecture as a pre/post memory boundary layer.

## Minimal algorithm sketch

1. Token/span scan input for sensitive entities + privacy level.
2. For entities above policy threshold, create stable typed placeholders (e.g., `<Email_1>`).
3. Persist local mapping `(placeholder ↔ original value, type, level, session scope)`.
4. Emit redacted payload to cloud memory runtime.
5. On cloud response, restore placeholders from local map.
6. Enforce PL4 zero-retention by dropping mappings after response.

## Deliverables in this folder

- `reference-architecture.md` — integration plan for agent-browser style runtimes.
- `experiments/experiment-01-policy-envelope.md` — first experiment spec and measurement plan.
- `experiments/experiment-01-trpe-scaffold.ts` — TypeScript scaffold implementing policy, masking, and restoration loop.
