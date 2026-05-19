# GitHub Actions Agent Automation

- Harness: Warp
- Sourced: 2026-05-19

## What it is
Warp can run agents directly inside GitHub Actions jobs, using workflow context and GitHub permissions to review code, comment on PRs, suggest fixes, and open branches as part of CI.

## Evidence
- Official docs: [GitHub Actions](https://docs.warp.dev/agent-platform/cloud-agents/integrations/github-actions)
- Official docs: [Agents Overview](https://docs.warp.dev/agents)
- First-party details:
  - the `oz-agent-action` wraps the Oz CLI inside an Actions job and can pass event payloads and prior step outputs into the prompt
  - Warp documents automated PR reviews with summary feedback, inline suggestions, one-click batching, and suggested-fix PR creation
  - the action can comment on pull requests, post results, or open branches through the GitHub token already available to the workflow
  - pre-built or custom skills can be applied in the workflow so the automation is packaged rather than prompt-only
- Latest development checkpoint:
  - Warp's current GitHub Actions docs treat CI-native agent work as a mainstream cloud-agent entrypoint, complete with demos, mention-based flows, and permission guidance

## Product signal
Warp is collapsing the gap between CI pipelines and agent execution, which matters for teams that want repository events to create reviewable agent work automatically.
