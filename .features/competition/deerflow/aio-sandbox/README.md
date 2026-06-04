# AIO Sandbox

- Harness: DeerFlow
- Sourced: 2026-06-04

## What it is
DeerFlow ships an all-in-one sandbox that combines browser, shell, file access, MCP, and a VS Code server inside one isolated runtime.

## Evidence
- DeerFlow docs: [Configuration](https://deerflow.tech/en/docs/application/configuration)
- GitHub README: [DeerFlow - 2.0](https://github.com/bytedance/deer-flow/blob/main/README.md)
- First-party details:
  - DeerFlow exposes separate local, Docker-container, and Kubernetes-provisioned sandbox modes through `LocalSandboxProvider` and `AioSandboxProvider`
  - the app docs recommend `deerflow.community.aio_sandbox:AioSandboxProvider` for isolated browser and command execution in containerized runs
  - each task gets thread-scoped `workspace`, `uploads`, and `outputs` directories mounted under `/mnt/user-data/`
  - host bash is explicitly gated in local mode and disabled by default, which makes the trust boundary part of the product contract

## Product signal
DeerFlow is treating execution isolation as core product surface, not just an implementation detail behind tool calls.
