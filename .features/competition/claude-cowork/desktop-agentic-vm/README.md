# Desktop Agentic VM

- Harness: Claude Cowork
- Refreshed: 2026-05-23

## What it is
Cowork ports Claude Code's agentic execution model into Claude Desktop for knowledge work, pairing local file access with isolated code and shell execution on the user's own machine.

## Evidence
- Official docs: [Get started with Claude Cowork](https://support.claude.com/en/articles/13345190-get-started-with-cowork)
- Release notes: [January 12, 2026 Cowork preview launch](https://support.claude.com/en/articles/12138966-release-notes)
- First-party details:
  - Anthropic describes Cowork as bringing Claude Code's agentic capabilities to desktop knowledge work beyond coding
  - Cowork runs directly on the user's computer, can read and write local files, and keeps the desktop app open while it works
  - code and shell commands run in an isolated virtual machine on the user's machine
  - outputs are meant to land as finished files and deliverables rather than chat-only replies
- Latest development checkpoint:
  - the April 9, 2026 general-availability milestone moved Cowork from preview to a cross-platform macOS and Windows desktop feature

## Product signal
Anthropic is making local agent execution accessible to non-terminal users without giving up the "runs on your machine" trust story that made coding harnesses compelling.
