# Native Desktop App With Remote Gateway Sessions

- Harness: Hermes Agent
- Sourced: 2026-06-06

## What it is
Hermes now ships a native desktop application for macOS, Windows, and Linux, and the app can either run the local agent or act as a thin client for remote Hermes gateways.

## Evidence
- Official docs: [Desktop App](https://hermes-agent.nousresearch.com/docs/user-guide/desktop)
- Official release: [Hermes Agent v0.16.0](https://github.com/NousResearch/hermes-agent/releases)
- First-party details:
  - the desktop docs describe a native app that shares the same config, sessions, skills, memory, and API keys as the CLI and gateway
  - the app provides streaming chat, drag-and-drop file attachment, a right-hand preview rail, file browsing, voice support, settings panes, and management panes for skills, cron, profiles, messaging, and orchestration surfaces
  - the `v0.16.0` release says the desktop app includes one-click install, in-app self-update, concurrent multi-profile sessions, archive and search, command palette access, and a status-bar model picker
  - the same release says the desktop client can connect to remote Hermes gateways over secure WebSocket with OAuth or username/password, with different profiles targeting different remote hosts
- Latest development checkpoint:
  - the current release line moves Hermes from "CLI with many side surfaces" to a full native desktop shell that can supervise local or remote runtimes without losing session continuity

## Product signal
Hermes is packaging the harness as a general-purpose desktop product while keeping the heavy runtime portable between localhost and remote gateways.
