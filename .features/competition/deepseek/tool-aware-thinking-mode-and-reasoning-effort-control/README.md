# Tool-Aware Thinking Mode And Reasoning Effort Control

- Harness: DeepSeek
- Sourced: 2026-05-14

## What it is
DeepSeek exposes thinking as an explicit execution mode with effort controls and special state-handling rules for tool-use turns, rather than treating reasoning as an opaque property of a model name.

## Evidence
- Official docs: [Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode)
- Official release: [DeepSeek-V3.1 Release](https://api-docs.deepseek.com/news/news250821)
- First-party details:
  - DeepSeek documents a toggle for `enabled/disabled` thinking plus `high/max` effort control
  - the docs say some complex agent requests such as `Claude Code` and `OpenCode` are automatically pushed to `max` effort
  - the API returns `reasoning_content` separately from the final answer
  - when a thinking-mode turn performs tool calls, DeepSeek requires that `reasoning_content` be passed back in all later requests
  - the V3.1 release frames this as a step toward `the agent era` and ties it to stronger tool use and multi-step agent tasks
- Latest development checkpoint:
  - DeepSeek carried this dual-mode contract forward into the V4 release on April 24, 2026, where both V4 models are documented as supporting Thinking and Non-Thinking modes

## Product signal
This is a stronger execution contract than a simple "reasoning model" toggle because tool-loop correctness now depends on the harness preserving and replaying reasoning state intentionally.
