# In-App Browser And Visual Comments

- Harness: Codex
- Sourced: 2026-05-16

## What it is
Codex app includes a shared in-app browser for previewing local or public pages, leaving visual comments, and optionally letting the agent operate the page directly through the Browser plugin.

## Evidence
- Official docs: [In-app browser](https://developers.openai.com/codex/app/browser)
- First-party details:
  - the browser gives the user and Codex a shared rendered view inside the thread
  - it supports local development servers, file-backed previews, and public pages that do not require sign-in
  - users can leave precise browser comments on elements or regions and ask Codex to address them
  - Browser plugin usage lets Codex click, type, inspect rendered state, take screenshots, and verify fixes inside the in-app browser
  - allowed and blocked website lists control where Browser plugin actions can run
- Latest development checkpoint:
  - current docs make visual feedback and browser-mediated verification a first-class part of the Codex app workflow rather than a sidecar debugging trick

## Product signal
Codex is turning rendered-page feedback into structured agent input, which is a stronger frontend loop than relying on screenshots pasted into chat.
