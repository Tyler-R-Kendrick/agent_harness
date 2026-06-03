# Windsurf Cascade Design

## Look And Feel

- Windsurf is a VS Code-derived AI IDE whose main UI differentiator is the Cascade side panel and its tight coupling to editor selection, terminal context, problems, checkpoints, and model selection.
- Marketing pages use polished consumer-developer language: "Where developers are doing their best work," "keep you in flow," and "local and cloud agents working together."
- The product blends familiar editor chrome with agent-native widgets: todo lists, queued messages, tool calls, memories, rules, workflows, app deploys, and simultaneous Cascade sessions.
- Enterprise pages add procurement polish: awards, testimonials, centralized billing, analytics, ZDR, SSO, RBAC, and hybrid deployment.

## Design Tokens To Track

```yaml
surface: AI-native code editor
accent: clean high-energy developer IDE branding
primary_control: Cascade panel prompt with model selector
core_objects:
  - Cascade Code
  - Cascade Chat
  - Todo list
  - queued message
  - checkpoint
  - memory
  - rule
  - workflow
  - app deploy
  - Devin cloud handoff
evidence_objects:
  - tool call
  - linter fix
  - checkpoint revert
  - shared conversation
  - public deploy URL
information_density: medium-high
```

## Differentiators

- Real-time awareness is the strongest design claim: Cascade watches recent user actions so the user can say "continue" without restating context.
- The Cascade panel supports Code and Chat modes, planning/todo lists, queued messages, tool calling, terminal integration, linter repair, web search, MCP, memories, rules, workflows, and app deploys.
- Checkpoints and reverts put recovery directly inside the conversation timeline.
- Windsurf 2.0 now markets local Cascade work plus Devin cloud delegation from one editor, widening the product from "agentic IDE" to "IDE plus autonomous cloud worker."

## What Is Good

- The UI preserves familiar editor habits while making agent work feel native rather than bolted on.
- Memories, rules, AGENTS.md support, workflows, and skills make customization more explicit than relying only on chat history.
- Problems-panel and linter integration create strong small-loop ergonomics: explain, fix, auto-fix, and continue.
- App Deploys gives web-app builders a visible outcome, public URL, and redeploy path without leaving the editor.

## Where It Breaks Down

- The same panel carries chat, code edits, tool calls, pricing-sensitive models, memories, deploys, and cloud delegation; users can struggle to know which subsystem failed.
- Simultaneous Cascades can race when two sessions edit the same file.
- Reverts are documented as irreversible, which is a sharp edge for users experimenting with agent edits.
- Community reports cite Cascade loading failures, Windows terminal behavior problems, blue-screen/crash anecdotes, model/credit confusion, and pricing anxiety.

## Screenshot References

- Windsurf 2.0 marketing surface: `https://windsurf.com/`
- Cascade overview, tool calls, checkpoints, and simultaneous sessions: `https://docs.windsurf.com/windsurf/cascade`
- Memories/rules customization: `https://docs.windsurf.com/windsurf/cascade/memories`
- App Deploys beta flow: `https://docs.windsurf.com/windsurf/cascade/app-deploys`
