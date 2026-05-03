# Summary Diff For Linear Feature Generation

Updated: 2026-05-03
Baseline: `.features/Summary.md` updated from the 2026-05-02 twenty-harness corpus.
Diff type: additive update after Goose research

## Net new normalized features

### Added: Private local inference and offline-first execution
- Why now: Goose has turned private local inference into a first-class harness feature instead of treating local models as an external integration that users must assemble themselves.
- Research delta:
  - the April 24, 2026 Goose blog says built-in local inference is available directly in the desktop app
  - Goose uses embedded `llama.cpp`, downloadable GGUF models, and in-process execution instead of requiring Ollama, Docker, or a background server
  - Goose frames the feature as private-by-default and offline-capable, which makes local execution part of the core harness product story rather than a power-user workaround

### Added: Context-aware tool-call guardrails with adversary review
- Why now: Goose is shipping a stronger answer to prompt injection and goal drift than static approval modes by adding a second-pass reviewer at the tool-call boundary.
- Research delta:
  - Goose supports four permission modes, but the newer differentiator is Adversary Mode
  - Adversary Mode checks each planned tool call against the original task, recent messages, and user-defined rules before execution
  - Goose positions the feature as protection against prompt injection and compromised or misaligned agent behavior, which makes runtime action review a productized safety loop

### Expanded: Parallel agent orchestration
- Why now: Goose's subagent docs show that orchestration now includes internal workers, external agents like Codex, explicit extension constraints, and parallel execution as normal operation.
- Research delta:
  - Goose can autonomously create subagents in autonomous mode
  - users can request sequential or parallel execution in natural language
  - Goose documents external subagents, including Codex configured as a delegated worker

### Expanded: Skills, plugins, and reusable workflow packaging
- Why now: Goose makes workflow packaging more launchable through recipes, subrecipes, project-local storage, and deeplink sharing.
- Research delta:
  - Goose recipes package prompts, extensions, and settings together
  - project-local `.goose/recipes/` storage makes workflows repo-aware
  - the recipe generator and deeplink flow make those workflows directly shareable and launchable

### Expanded: External tool connectivity and actionability
- Why now: Goose combines broad MCP reach with smarter install and activation mechanics instead of stopping at basic server compatibility.
- Research delta:
  - Goose advertises 70+ extensions and says arbitrary MCP servers can be added
  - Goose adds malware checks, smart extension recommendation, and roots-aware workspace mapping
  - Goose also bridges to ACP clients and ACP providers, widening the range of external agent and tool surfaces it can coordinate

### Added: Add built-in local inference for browser-agent sessions
- Why now: `agent-browser` currently assumes hosted-model execution, while Goose shows that private, offline, zero-dependency local execution can be a core harness differentiator for sensitive repositories and unreliable-network workflows.
- Linear issue title:
  - `Add built-in local inference for browser-agent sessions`
- Suggested problem statement:
  - `agent-browser` lacks a built-in local inference path, so teams that need offline operation, private-by-default execution, or zero external API dependence still have to leave the product surface and assemble separate local-model infrastructure.
- One-shot instruction for an LLM:
  - Implement built-in local inference for `agent-browser` so users can download supported local models inside the app, run browser-agent sessions offline or on sensitive codebases without a sidecar server, see capability and hardware constraints clearly, and switch between local and hosted models without changing the rest of the harness workflow.

### Added: Add adversary-style tool-call review for browser-agent actions
- Why now: `agent-browser` has approvals and validation surfaces, but it still lacks a contextual reviewer that evaluates each browser or tool action against user intent before execution, which Goose now productizes as Adversary Mode.
- Linear issue title:
  - `Add adversary-style tool-call review for browser-agent actions`
- Suggested problem statement:
  - `agent-browser` can ask for approval, but it does not yet have a contextual second-pass reviewer that can catch prompt injection, unsafe browser actions, or tool-call drift before execution based on the actual task and recent conversation state.
- One-shot instruction for an LLM:
  - Implement an adversary-style runtime reviewer for `agent-browser` that intercepts planned tool and browser actions, compares them against user intent, recent context, and policy, then allows, blocks, or escalates those actions with an inspectable rationale and a fail-safe operator experience.

## How to use this file

1. Treat each `Added:` section as a candidate Linear epic or feature.
2. Convert the `Linear issue title` into the issue title.
3. Use the `Suggested problem statement` as the issue body opener.
4. Paste the `One-shot instruction for an LLM` into implementation planning or issue enrichment.

## Recommended next Linear batch

1. `Add built-in local inference for browser-agent sessions`
2. `Add adversary-style tool-call review for browser-agent actions`
