# AIO Sandbox

- Harness: DeerFlow
- Sourced: 2026-04-26

## What it is
DeerFlow ships an all-in-one sandbox that combines browser, shell, file access, MCP, and a VS Code server inside one isolated runtime.

## Evidence
- Official site: [DeerFlow](https://deerflow.tech/)
- GitHub README: [DeerFlow - 2.0](https://github.com/bytedance/deer-flow/blob/main/README.md)
- First-party details:
  - the product site recommends an "All-in-One Sandbox" combining Browser, Shell, File, MCP, and VSCode Server
  - the README describes `AioSandboxProvider` and separate local, Docker, and Kubernetes-backed sandbox modes
  - each task gets its own filesystem with `uploads`, `workspace`, and `outputs`

## Product signal
DeerFlow is treating execution isolation as core product surface, not just an implementation detail behind tool calls.
