# Agent Modes Plan Fast Reasoning Personalities And Skills

- Harness: Conductor
- Sourced: 2026-05-12

## What it is
Conductor exposes multiple agent operating modes and steering primitives so users can change how the harness reasons and behaves without rewriting the entire task prompt each time.

## Evidence
- Official docs: [Agent modes](https://www.conductor.build/docs/concepts/agent-modes)
- Official docs: [Big Terminal Mode](https://www.conductor.build/docs/reference/big-terminal-mode)
- First-party details:
  - Conductor documents distinct agent modes rather than one monolithic behavior profile
  - the modes cover different speed and reasoning postures
  - Conductor also documents personalities and skills as reusable steering mechanisms alongside the mode system
- Latest development checkpoint:
  - the current docs keep mode selection and reusable steering artifacts in the main product vocabulary, indicating Conductor sees behavior control as a product-level concern

## Product signal
This reflects the broader trend toward explicit execution profiles and reusable steering assets instead of relying on one giant general-purpose system prompt.
