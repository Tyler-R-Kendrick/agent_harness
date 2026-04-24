# Agent Harness Competition Summary

Research snapshot date: 2026-04-23

Harnesses covered in this pass:

- Hermes Agent
- OpenClaw
- Codex
- Claude Code
- Claude Cowork
- ChatGPT
- Claude in Chrome
- GitHub Copilot in VS Code

## Normalized Feature Map

### 1. Persistent project instructions

- Common description: A repo, project, folder, or workspace can carry durable instructions that automatically shape future agent behavior.
- Seen in:
  - Codex: `AGENTS.md`
  - Claude Code: `CLAUDE.md`
  - Claude Cowork: global and folder instructions
  - OpenClaw: injected prompt files and workspace skill structure
  - ChatGPT: project-scoped organization and memory
- Trend signal: This has become foundational. Harnesses increasingly assume long-lived context instead of one-shot prompting.

### 2. Skill, plugin, or command packaging

- Common description: Reusable workflows and domain knowledge are packaged into lightweight units that load on demand.
- Seen in:
  - Hermes Agent: skills and self-created skills
  - OpenClaw: bundled, managed, and workspace skills
  - Codex: skills
  - Claude Code: skills and slash-command-backed workflows
  - Claude Cowork: plugins that bundle skills/connectors
- Trend signal: The winning shape is not a giant monolithic prompt. It is a thin runtime with composable workflow modules.

### 3. MCP and external connector expansion

- Common description: The harness can connect to external data, APIs, services, and tools through MCP or first-party connectors.
- Seen in:
  - Claude Code: MCP
  - Claude Cowork: connectors and plugins
  - ChatGPT: connectors and deep research source selection
  - GitHub Copilot: MCP-aware agent workflows
  - Hermes Agent: toolsets and MCP-capable architecture
- Trend signal: Extension ecosystems are now table stakes for serious agents.

### 4. Subagents and parallel work

- Common description: The system can split work into isolated subagents or parallel workstreams and merge results later.
- Seen in:
  - Hermes Agent
  - Codex
  - Claude Code
  - Claude Cowork
  - OpenClaw
  - GitHub Copilot agent mode and coding agent
- Trend signal: Parallel delegation is one of the strongest consistent signals across coding and knowledge-work harnesses.

### 5. Background execution and long-running tasks

- Common description: The agent can keep working after the initial prompt and complete larger jobs asynchronously.
- Seen in:
  - Codex cloud tasks
  - Claude Cowork long-running tasks
  - ChatGPT deep research
  - ChatGPT tasks
  - Claude in Chrome background workflows
  - Hermes scheduled automations
- Trend signal: Harnesses are increasingly optimized for outcome delivery, not turn-by-turn chat.

### 6. Scheduled automations

- Common description: The platform can run saved tasks on a schedule without a live user session.
- Seen in:
  - Hermes Agent
  - Codex
  - Claude Cowork
  - ChatGPT
  - OpenClaw cron and wakeups
- Trend signal: Scheduling is converging into a core primitive for personal and team agents.

### 7. Cross-surface handoff

- Common description: Work can move across terminal, desktop, browser, mobile, messaging, or cloud surfaces without losing context.
- Seen in:
  - Codex CLI, IDE, app, cloud
  - Claude Code terminal, desktop, web, phone
  - Claude in Chrome plus Claude Desktop
  - GitHub Copilot VS Code plus CLI plus GitHub
  - Hermes CLI plus messaging
  - OpenClaw gateway plus device apps
- Trend signal: The most competitive harnesses now act like operating environments, not single apps.

### 8. Browser action and verification layers

- Common description: The agent can inspect and operate the live browser as part of execution or verification.
- Seen in:
  - Claude in Chrome
  - OpenClaw browser control
  - Claude Cowork computer use
  - Codex app positioning around multi-surface agents
- Trend signal: Browser-native loops are now central, especially for testing, form workflows, and visual verification.

### 9. Evidence, reviewability, and trust controls

- Common description: The platform shows logs, citations, diffs, review steps, permissions, or verifier layers so users can inspect what happened.
- Seen in:
  - Codex evidence and terminal/test citations
  - Claude Code hook controls and code review verifier
  - GitHub Copilot PR/session model
  - Claude in Chrome permission modes
  - Claude Cowork explicit permissions and VM isolation
- Trend signal: Trust UX is moving from secondary docs into first-class product design.

### 10. Visual workspaces and canvases

- Common description: The agent can produce or manipulate a richer visual workspace than plain chat.
- Seen in:
  - OpenClaw live Canvas
  - ChatGPT Canvas
  - Claude in Chrome side panel plus visual context
  - Claude Cowork professional output generation
- Trend signal: Visual collaboration surfaces are becoming a primary shell for complex work.

### 11. Local control planes and dashboards

- Common description: A local or desktop control plane manages agents, sessions, skills, and runtime settings.
- Seen in:
  - Hermes local web dashboard
  - Codex app
  - OpenClaw gateway and control UI
  - Claude Desktop surfaces for Cowork and browser connectivity
- Trend signal: Users want agents to stay inspectable and steerable even when they run in the background.

### 12. Inline coding assistance remains important

- Common description: Even with autonomous agents, high-frequency local assistive UX still matters.
- Seen in:
  - GitHub Copilot ghost text and next edit suggestions
  - Claude Code command/session controls
  - Codex local pairing
  - ChatGPT Canvas coding shortcuts
- Trend signal: The best products combine high-agency delegation with low-friction micro-assistance.

## Practical Takeaways For `agent-browser`

Highest-signal opportunity areas for `agent-browser` based on this survey:

1. Build durable project instructions and memory boundaries directly into the product surface.
2. Treat subagents, scheduling, and background execution as product features, not hidden implementation details.
3. Make browser verification first-class by combining live page control with evidence capture and review-friendly output.
4. Add a lightweight skill/plugin layer so new workflows can be shipped without deep core changes.
5. Invest in a control plane that spans terminal, browser, desktop, and cloud execution.

## Coverage Notes

- This pass prioritized current official docs, help centers, product pages, release notes, and primary repository READMEs.
- Some source pages referenced screenshots or embedded visuals, but the captured text often did not expose direct media URLs. Those cases are called out in the individual feature docs.
