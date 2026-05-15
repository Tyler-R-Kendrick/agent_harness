# Persistent Goals Ralph Loop

- Harness: Hermes Agent
- Sourced: 2026-05-15

## What it is
Hermes can keep a goal alive across turns with a judge-driven continuation loop so the agent keeps working until the objective is satisfied, blocked, paused, or budget-exhausted.

## Evidence
- Official docs: [Persistent Goals](https://hermes-agent.nousresearch.com/docs/user-guide/features/goals)
- Official release: [Hermes Agent v0.13.0](https://github.com/NousResearch/hermes-agent/releases)
- First-party details:
  - `/goal` stores a standing objective that survives across turns
  - after every turn, a lightweight judge model checks whether the goal is satisfied and can feed a continuation prompt back into the same session
  - the docs explicitly recommend it for multi-step tasks such as fixing lint, porting features, or investigating failures until a terminal condition is reached
  - the `v0.13.0` release highlights `/goal` as a mechanism for locking the agent onto a target across turns
- Latest development checkpoint:
  - current docs present persistent goals as a default workflow primitive for autonomous iteration rather than a hidden power-user command

## Product signal
Hermes is formalizing "keep going until done" as an inspectable runtime loop with a judge and continuation semantics, which is more durable than telling the model to be persistent in plain language.
