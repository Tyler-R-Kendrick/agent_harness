# Computer Use And Dispatch

- Harness: Claude Cowork
- Refreshed: 2026-05-23

## What it is
Cowork can fall back from connectors to browser automation to direct desktop control, letting Claude operate the user's machine when API-style integrations are unavailable.

## Evidence
- Release notes: [March 23, 2026 computer use and Dispatch update](https://support.claude.com/en/articles/12138966-release-notes)
- Official docs: [Let Claude use your computer in Cowork](https://support.claude.com/en/articles/14128542-let-claude-use-your-computer-in-cowork)
- First-party details:
  - Anthropic describes a three-step action order: connectors first, then browser automation through Claude in Chrome, then direct screen interaction
  - Claude can click, type, open apps, navigate browser pages, open files, and run dev tools automatically
  - per-app permissions gate access to applications, and some sensitive apps are blocked by default
  - computer use can support tasks that do not have a connector, such as internal dashboards or specialized desktop tools
  - computer use is available in both Cowork and Claude Code on macOS and Windows for Pro and Max during the current research preview
- Latest development checkpoint:
  - Anthropic has repositioned computer use as part of the normal Cowork tool hierarchy instead of as a standalone experimental demo

## Product signal
Cowork is making GUI action a built-in fallback layer, which suggests future harnesses will be judged not just by API connectivity but by how gracefully they bridge into browser and desktop control when APIs end.
