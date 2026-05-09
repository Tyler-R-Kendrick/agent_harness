# Mode-Bound Model Profiles And Sticky Task Inheritance

- Harness: Roo Code
- Sourced: 2026-05-09

## What it is
Roo lets users define execution profiles for different providers and models, bind those profiles to specific modes, and keep the chosen profile sticky across task resumes, worktrees, and orchestrated subtasks.

## Evidence
- Official docs: [API Configuration Profiles](https://docs.roocode.com/features/api-configuration-profiles)
- Official repo README: [Roo Code](https://github.com/RooCodeInc/Roo-Code)
- First-party details:
  - profiles can hold different providers, models, thinking budgets, temperatures, diff-edit settings, and rate limits
  - users can pin favored profiles and switch them directly from chat
  - Roo can explicitly associate a configuration profile with each mode
  - each task remembers the profile it started with when reopened from history
  - Orchestrator subtasks inherit the parent profile and keep it for their lifetime
- Latest development checkpoint:
  - the docs page was last updated on February 17, 2026, and the newer GitHub README says the April 23, 2026 `v3.53.0` release added GPT-5.5 support through the OpenAI Codex provider, which reinforces Roo's profile-driven multi-model posture

## Product signal
Roo is treating model choice as durable execution state, not a loose per-message toggle, which reduces drift when work spans multiple modes, resumptions, or delegated subtasks.
