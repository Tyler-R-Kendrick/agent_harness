# Agent Mode

- Harness: ChatGPT
- Sourced: 2026-05-21

## What it is
Agent mode is ChatGPT's unified long-running task surface for reasoning, browsing, using apps, editing spreadsheets, and taking supervised actions on a user's behalf across web, mobile, and desktop.

## Evidence
- Help article: [ChatGPT agent](https://help.openai.com/en/articles/11752874-chatgpt-agent)
- Tools called out:
  - visual browser
  - code interpreter
  - apps
  - terminal
- Runtime behavior called out:
  - 5 to 30 minute tasks
  - can be interrupted mid-task
  - pauses for confirmation or clarification
  - scheduled follow-up runs after completion
- Safety and control details called out:
  - watch mode on certain sites
  - takeover mode for sensitive logins
  - screenshots for browser-state reasoning
  - persistent cookies plus explicit browser-data clearing controls
- Official visual:
  - the help article includes a product screenshot of the agent composer with enabled apps

## Product signal
OpenAI has collapsed browsing, operator-style computer use, app connectivity, and scheduled follow-through into one shared agent runtime rather than separate products.
