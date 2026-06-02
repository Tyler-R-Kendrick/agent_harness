# In-App Browser And Visual Comments

- Harness: Codex
- Sourced: 2026-06-02

## What it is
Codex app includes a shared in-app browser for previewing local or public pages, leaving visual comments, and optionally letting the agent operate the page directly through the Browser plugin.

## Evidence
- Official docs: [In-app browser](https://developers.openai.com/codex/app/browser)
- Official release notes: [ChatGPT release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes)
- First-party details:
  - the browser gives the user and Codex a shared rendered view inside the thread
  - it supports local development servers, file-backed previews, and public pages that do not require sign-in
  - users can leave precise browser comments on elements or regions and ask Codex to address them
  - Browser plugin usage lets Codex click, type, inspect rendered state, take screenshots, and verify fixes inside the in-app browser
  - allowed and blocked website lists control where Browser plugin actions can run
  - the May 21, 2026 update added advanced annotation mode, faster asset extraction, a read-only JavaScript context, improved tab grouping, less extension-tab clutter, and broader browser reliability work
- Latest development checkpoint:
  - current first-party guidance moves the browser surface beyond screenshots plus comments into a more inspectable, faster, and less error-prone rendered-workspace loop

## Product signal
Codex is turning rendered-page feedback into structured agent input and a richer verification surface, which is a stronger frontend loop than relying on screenshots pasted into chat.
