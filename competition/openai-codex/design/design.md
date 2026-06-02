# OpenAI Codex Design

## Look And Feel

- App-first command center for supervising multiple coding agents, with project threads, isolated task context, diff review, comments, and editor handoff.
- The visual language is close to ChatGPT: clean white/neutral surfaces, conversational task threads, restrained controls, and progressive task status rather than an IDE-dense screen.
- Cloud and local surfaces share account-level controls, so the design centers on "where should this agent run" rather than "which tool do I install."

## Design Tokens To Track

```yaml
surface: desktop app, ChatGPT sidebar, CLI, IDE extension, GitHub review
accent: OpenAI neutral product chrome with task-status highlights
primary_control: prompt-to-task plus threaded diff review
core_objects:
  - project
  - agent thread
  - cloud task
  - local task
  - diff
  - pull request
  - usage credits
  - workspace controls
information_density: medium
trust_surfaces:
  - isolated task threads
  - code diffs
  - editor handoff
  - usage page
  - local/cloud admin controls
```

## Differentiators

- Multi-agent supervision is the product shape: OpenAI describes the app as a space for parallel agents and long-running tasks rather than a single chat pane.
- Codex is available across app, CLI, IDE, GitHub, and cloud tasks through the ChatGPT account, reducing switching costs for teams already using OpenAI.
- Pricing and limits are now represented through token-based Codex credits, making usage visibility a first-class part of the product.
- Browser and visual work are moving into the coding loop through screenshots, frontend iteration, and app/browser context.

## What Is Good

- The app acknowledges the real coordination problem: users need to supervise several agents, compare diffs, and hand work back to a human editor.
- The diff-comment loop is more review-native than a pure terminal transcript.
- Workspace controls split local and cloud authority, which is useful for enterprise buyers deciding where code and execution can live.
- A shared account model makes Codex easy to adopt for users already paying for ChatGPT.

## Where It Breaks Down

- The design can hide browser-level evidence behind summarized task status and diffs; users may still need screenshots, recordings, and deterministic traces for UI behavior.
- Credit and token metering introduces planning anxiety for long-running or exploratory agents.
- A model-owner command center can feel opaque when an agent silently burns context, retries, or chooses a different implementation path than expected.
- The app is optimized for code review more than for live web authority, credential boundaries, and page-level recovery.

## Screenshot References

- Codex app product screenshots and thread/diff examples: `https://openai.com/index/introducing-the-codex-app/`
- Codex product page: `https://openai.com/codex/`
