# Skills, Tools, And Claude Code Bridge

- Harness: DeerFlow
- Sourced: 2026-04-26

## What it is
DeerFlow packages workflows as progressively loaded skills, supports custom tools, and ships an official bridge that lets Claude Code drive a live DeerFlow instance.

## Evidence
- GitHub README: [DeerFlow - 2.0](https://github.com/bytedance/deer-flow/blob/main/README.md)
- First-party details:
  - DeerFlow ships built-in skills for research, report generation, slides, web pages, image generation, and video generation
  - skills load only when needed to keep context lean
  - custom tools can be added through MCP servers and Python functions
  - the `claude-to-deerflow` skill lets Claude Code send work to DeerFlow, manage threads, inspect status, and upload files

## Product signal
This is a strong example of harnesses turning reusable workflow packaging and cross-agent interoperability into first-class product features.
