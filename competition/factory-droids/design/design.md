# Factory Droids Design

## Look And Feel

- Product surface is "agent-native developer platform" more than IDE plugin: command-line install, desktop app, browser control, cloud computers, Slack, Jira, GitHub, and enterprise governance are presented as one connected system.
- Marketing pages use high-contrast SaaS sections, large product claims, workflow diagrams, customer quotes, and short value blocks around "one prompt to PR."
- Documentation is command-heavy and operational: slash commands, missions, MCP, custom droids, pricing windows, and enterprise deployment controls.
- Mission Control introduces a planning-and-orchestration view that looks closer to a project-management console than a chat transcript.

## Design Tokens To Track

```yaml
surface: multi-platform coding-agent workspace
accent: dark developer SaaS with AI-agent control-plane framing
primary_control: natural-language task plus Droid CLI slash commands
core_objects:
  - Droid
  - Mission
  - Mission Control
  - Droid Computer
  - custom Droid
  - MCP server
  - approval
  - pull request
evidence_objects:
  - command trace
  - plan milestones
  - tests
  - PR
  - Droid Control recording
information_density: high
```

## Differentiators

- "Any interface, any IDE" is the design thesis. Factory tries to meet teams in terminal, IDE, browser, Slack, CI, Jira, and GitHub instead of forcing one editor.
- Missions create a structured preflight flow: clarify the goal, define features and milestones, approve the plan, then let Mission Control coordinate execution.
- Droid Computers move Droids into Factory-managed or bring-your-own machines, which makes the product compete with cloud agents and local CLI agents at once.
- Droid Control explicitly records software-operation evidence with a Playwright-shaped CLI and video-like proof, which is unusually close to `agent-browser`'s evidence wedge.

## What Is Good

- The workflow starts with developer-native primitives rather than a new canvas: CLI, IDE, GitHub App, slash commands, MCP, and PRs.
- Adjustable autonomy and explicit permission framing give buyers a clearer safety story than "the agent just works."
- Missions make long-running work easier to inspect than a single unbounded chat thread.
- Enterprise pages speak directly to regulated buyers: ZDR, model controls, audit logs, network policy, data residency, on-prem, airgapped, and OTEL-native observability.

## Where It Breaks Down

- The number of surfaces can blur the mental model. A new user must understand Droids, Missions, Droid Computers, Droid Control, custom Droids, MCP, usage windows, Core models, and extra usage.
- Rolling 5-hour, weekly, and monthly limits make cost and availability harder to predict than a simple fixed seat price.
- Reddit reports mention lag in the desktop interface, unclear quotas, unstable model-specific behavior, and signup/free-trial confusion.
- Factory's benchmark-forward and agent-orchestration language can feel overclaimed when the underlying model loops, stalls, or produces uneven implementation quality.

## Screenshot References

- Product landing and multi-surface workflow: `https://factory.ai/product/droids`
- Mission Control orchestration view: `https://docs.factory.ai/cli/features/missions`
- Droid Control recording-oriented CLI: `https://docs.factory.ai/cli/features/droid-control`
