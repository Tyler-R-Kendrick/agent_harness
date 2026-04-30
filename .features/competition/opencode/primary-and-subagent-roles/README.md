# Primary And Subagent Roles

- Harness: OpenCode
- Sourced: 2026-04-28

## What it is
OpenCode ships with explicit primary agents and subagents, including restricted planning roles and manually invokable specialist agents.

## Evidence
- Official docs: [Agents](https://opencode.ai/docs/agents/)
- First-party details:
  - the docs define two agent types: `primary agents` and `subagents`
  - built-in primary agents include `Build` and `Plan`
  - built-in subagents include `General` and `Explore`
  - users can switch agents during a session or invoke them with `@` mentions

## Product signal
This is a direct move toward role-based orchestration where specialization is a first-class interface concept.
