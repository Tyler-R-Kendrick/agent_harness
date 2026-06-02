# Appshots Window Context Capture

- Harness: Codex
- Sourced: 2026-06-02

## What it is
Codex Appshots let users attach the active macOS app window to a thread with one hotkey so the agent receives both a screenshot and any available text from the window.

## Evidence
- Official release notes: [ChatGPT release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes)
- First-party details:
  - Appshots were announced in the May 21, 2026 Codex update
  - the Codex macOS app can capture an app window directly into the current thread
  - the capture includes both a screenshot and machine-readable text when available
  - OpenAI positions Appshots as a faster alternative to writing a long setup prompt when the key context is already visible on screen
- Latest development checkpoint:
  - current first-party positioning treats the desktop window itself as a structured context source instead of expecting the user to manually translate what they see into chat instructions

## Product signal
Codex is reducing the gap between ambient desktop context and agent input by turning the active window into a one-step attachment surface.
