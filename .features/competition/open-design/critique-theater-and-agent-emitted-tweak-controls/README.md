# Critique Theater And Agent Emitted Tweak Controls

- Harness: Open Design
- Sourced: 2026-05-13

## What it is
Open Design pairs self-critique with explicit tweak surfaces so the agent can score and refine its own design outputs in a structured, inspectable loop.

## Evidence
- Official README: [Open Design](https://github.com/nexu-io/open-design)
- Official release notes: [Open Design 0.6.0](https://github.com/nexu-io/open-design/releases)
- First-party details:
  - the built-in skill catalog includes a dedicated `critique` skill with five-dimensional scoring across philosophy, hierarchy, detail, function, and innovation
  - the catalog also includes a `tweaks` skill where the model surfaces the parameters worth nudging after first generation
  - the main README says the daemon runs a five-dimensional critique against its own output as part of the prompt stack
  - the 0.6.0 release adds Critique Theater Phase 6.1 with a project-keyed run registry and an interrupt endpoint
- Latest development checkpoint:
  - the May 9, 2026 `0.6.0` release turns critique into an interruptible operational surface, not only a prompt-side heuristic

## Product signal
Open Design is productizing self-review as a visible stage with runtime controls, which is a stronger pattern than burying refinement inside hidden retry loops.
