# Agent Teams Lead Worker Messaging

- Harness: Claude Code
- Sourced: 2026-06-05

## What it is
Claude Code now documents agent teams as a distinct multi-session orchestration mode with a lead session, independent teammates, direct inter-agent messaging, and centralized supervision.

## Evidence
- Docs: [Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams)
- Changelog: [Claude Code changelog](https://code.claude.com/docs/en/changelog)
- Current first-party details:
  - agent teams are experimental and gated behind `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`
  - one session acts as the team lead that coordinates work, assigns tasks, and synthesizes results
  - teammates run in their own context windows and can communicate directly with each other
  - unlike subagents, users can interact with individual teammates directly instead of only through the lead
  - Anthropic frames teams as the right fit when parallel exploration matters more than simple delegated subtasks
  - the docs call out current limitations around resumption, coordination, and shutdown, which makes the orchestration contract explicit instead of implied

## Product signal
Claude Code is separating inline delegation from full multi-session teamwork, which suggests future harnesses need more than one parallelism model.
