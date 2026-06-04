# Skills, Tools, And Claude Code Bridge

- Harness: DeerFlow
- Sourced: 2026-06-04

## What it is
DeerFlow packages workflows as progressively loaded skills, supports custom and MCP-backed tools, and ships an official bridge that lets Claude Code drive a live DeerFlow instance.

## Evidence
- DeerFlow docs: [Skills](https://deerflow.tech/en/docs/harness/skills)
- GitHub README: [DeerFlow - 2.0](https://github.com/bytedance/deer-flow/blob/main/README.md)
- First-party details:
  - DeerFlow ships a broad public skill set including deep research, data analysis, charting, presentations, image generation, academic review, consulting analysis, GitHub deep research, frontend design, and video generation
  - skills load only when needed to keep context lean, and the harness mounts them into the sandbox at `/mnt/skills`
  - skill content is security-scanned before loading, and dependencies can be installed on first use
  - custom tools can be added through MCP servers and Python functions
  - the `claude-to-deerflow` skill lets Claude Code send work to DeerFlow, manage threads, inspect status, and upload files

## Product signal
This is a strong example of harnesses turning reusable workflow packaging and cross-agent interoperability into first-class product features.
