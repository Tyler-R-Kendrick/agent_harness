# Workspace Access Tokens For Trusted Automation

- Harness: Codex
- Sourced: 2026-06-02

## What it is
Codex can issue workspace-scoped access tokens so trusted local scripts, schedulers, and private CI workflows can run with ChatGPT workspace identity without an interactive browser sign-in.

## Evidence
- Official product post: [Work with Codex from anywhere](https://openai.com/index/work-with-codex-from-anywhere/)
- Official release notes: [ChatGPT Business release notes](https://help.openai.com/en/articles/11391654)
- First-party details:
  - access tokens were announced with the May 14, 2026 remote-access rollout
  - OpenAI positions them for trusted, non-interactive local workflows
  - the release notes call out scripts, schedulers, and private CI runners as target use cases
  - the tokens preserve ChatGPT workspace identity and enterprise controls instead of forcing users to rely on a personal browser login
- Latest development checkpoint:
  - Codex is no longer treating automation as app-only background work; it is starting to expose governed credentials so the same control plane can drive external local automation surfaces

## Product signal
Codex is extending its execution model beyond the app UI into workspace-governed automation infrastructure.
