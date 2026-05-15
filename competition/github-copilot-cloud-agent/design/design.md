# GitHub Copilot Cloud Agent Design

## Look And Feel

- Native GitHub workflow surface: issues, pull requests, dashboard, repository pages, Actions, mobile, IDE chat, CLI, MCP, Slack, Teams, Jira, Linear, and Azure Boards.
- The interaction model is assignment and delegation, not an external workspace.
- GitHub's design advantage is ambient availability: the agent appears in the same places users already triage work.

## Design Tokens To Track

```yaml
surface: GitHub.com, issues, pull requests, Actions, IDE chat, CLI, mobile, MCP
accent: repository-native delegation
primary_control: assign issue or delegate task
core_objects:
  - issue
  - agent session
  - pull request
  - custom agent
  - premium request
  - Actions minutes
  - review
information_density: high
```

## Differentiators

- Users can start agent work from many entry points, including Issues, dashboard, IDEs, GitHub Mobile, CLI, MCP server, Raycast, and failing Actions workflows.
- Third-party agents such as OpenAI Codex and Anthropic Claude can be used alongside Copilot cloud agent in supported plans.
- The product inherits GitHub's existing security, audit, branch, PR, review, and CI model.

## What Is Good

- Assigning an issue to an agent is a workflow teams already understand.
- PR handoff keeps human review in the loop.
- The breadth of entry points makes Copilot hard to avoid for teams already standardized on GitHub.

## Where It Breaks Down

- The agent is cloud-first and repo-first, so local runtime state, browser evidence, and visual traces are secondary.
- Cost is tied to premium requests and Actions minutes, which can be opaque when model routing or session boundaries are unclear.
- Native placement creates reputational risk when the agent writes unexpected text into professional artifacts.

## Screenshot References

- Issue assignment flow: `https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/use-copilot-agents/cloud-agent/start-copilot-sessions`
- Third-party agent concepts: `https://docs.github.com/en/copilot/concepts/agents/about-third-party-agents`
