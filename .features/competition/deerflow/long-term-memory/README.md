# Long-Term Memory

- Harness: DeerFlow
- Sourced: 2026-06-04

## What it is
DeerFlow keeps persistent cross-session memory about user preferences and project context, then injects that memory back into future runs, including per-agent memory partitions for custom specialists.

## Evidence
- DeerFlow docs: [Work with Memory](https://deerflow.tech/en/docs/tutorials/work-with-memory)
- First-party details:
  - `MemoryMiddleware` learns facts automatically from conversations when memory is enabled
  - `injection_enabled`, `max_injection_tokens`, and `debounce_seconds` govern how memory returns to later prompts
  - workspace-level memory is stored in `backend/.deer-flow/memory.json`
  - custom agents maintain separate memory files under `backend/.deer-flow/agents/{agent_name}/memory.json`
  - memory can be inspected directly rather than being hidden behind provider-side personalization

## Product signal
This reinforces that durable memory is shifting toward inspectable, scope-aware runtime infrastructure rather than an opaque personalization layer.
