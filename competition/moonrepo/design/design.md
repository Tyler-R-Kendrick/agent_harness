# moonrepo v2 Design

## Look And Feel

- Dense, engineering-first launch narrative focused on architecture shifts, performance boundaries, and migration mechanics.
- Clear division between stable primitives (workspace graph, tasks, project metadata) and new extensibility surfaces.
- Product voice favors deterministic reproducibility over opaque automation.

## Differentiators Relevant To Agent Harness

- WASM-oriented extensibility points allow language-agnostic plugin execution with host-controlled capabilities.
- Toolchain surfaces are modeled as explicit contracts, making runtime behavior inspectable and testable.
- Versioned interfaces and compatibility strategy reduce long-term breakage risk for teams with large monorepos.

## What To Duplicate

1. **Portable provider model**: one core registration layer, multiple execution backends.
2. **Contract-first tool definitions**: strongly typed tool declarations and deterministic invocation semantics.
3. **WASI alignment**: isolate side effects via host-provided interfaces and capability-scoped runtime context.

## Screenshot References

- InfoQ release summary: `https://www.infoq.com/news/2026/05/moonrepo-2-release/`
- moonrepo v2 launch post: `https://moonrepo.dev/blog/moon-v2.0`
