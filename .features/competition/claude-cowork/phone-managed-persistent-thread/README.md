# Phone Managed Persistent Thread

- Harness: Claude Cowork
- Refreshed: 2026-05-23

## What it is
Cowork's Dispatch experience gives users one persistent thread they can reach from desktop or mobile, with Claude spinning up the right underlying Cowork or Claude Code session and returning the finished result back to that shared conversation.

## Evidence
- Release notes: [March 17, 2026 persistent-thread launch](https://support.claude.com/en/articles/12138966-release-notes)
- Official docs: [Assign tasks from anywhere in Claude Cowork](https://support.claude.com/en/articles/13947068-assign-tasks-to-claude-from-anywhere-in-cowork)
- First-party details:
  - users get one continuous conversation that works from phone or desktop
  - the thread keeps context across tasks instead of resetting for each request
  - Claude decides whether to route the work into Claude Code or Cowork depending on the task
  - outputs come back to the persistent thread as finished files, memos, tables, or pull requests
  - the same thread can request follow-ups, receive push notifications, and trigger scheduled work
- Latest development checkpoint:
  - Anthropic now presents mobile dispatch as a core Cowork control surface rather than a novelty remote-control add-on

## Product signal
Anthropic is treating the agent thread as a cross-surface control plane, which raises the bar for continuity between mobile supervision and desktop execution.
