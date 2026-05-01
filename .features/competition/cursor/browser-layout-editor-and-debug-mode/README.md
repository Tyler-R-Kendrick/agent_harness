# Browser Layout Editor And Debug Mode

- Harness: Cursor
- Sourced: 2026-05-01

## What it is
Cursor combines browser-aware debugging with a live layout editor so the agent can inspect runtime behavior, manipulate UI visually, and then apply those changes back to the codebase.

## Evidence
- Official changelog: [Debug Mode, Plan Mode Improvements, Multi-Agent Judging, and Pinned Chats](https://cursor.com/changelog/2-2)
- Official changelog: [Browser Controls, Plan Mode, and Hooks](https://cursor.com/changelog/1-7)
- First-party details:
  - Cursor says Debug Mode instruments the app with runtime logs to find root causes across stacks and languages
  - the same release adds a browser sidebar and component tree for moving elements, changing colors, testing layouts, and sending visual edits back through the agent
  - the earlier `1.7` release established browser controls as a first-class capability for screenshots, UI improvement, and client-side debugging
  - recent releases also mention multiple parallel Debug Mode sessions and richer browser-tool controls, which suggests Cursor is continuing to invest in browser-native debugging workflows
- Latest development checkpoint:
  - the December 10, 2025 and March 3, 2026 releases together show browser-aware debugging moving from a novelty tool into a serious part of the agent workflow

## Product signal
Cursor is collapsing the boundary between browser inspection, runtime debugging, and code editing, which is directly relevant to any harness centered on browser-capable agents.
