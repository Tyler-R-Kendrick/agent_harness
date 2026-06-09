# One-Million-Token Context And Reasoning Effort Controls

- Harness: GitHub Copilot
- Sourced: 2026-06-09

## What it is
GitHub Copilot now exposes larger context windows, configurable reasoning effort, utility-model routing, and better token visibility as first-class runtime controls across VS Code, Copilot CLI, and the Copilot app.

## Evidence
- Changelog: [Larger context windows and configurable reasoning levels for GitHub Copilot](https://github.blog/changelog/2026-06-04-larger-context-windows-and-configurable-reasoning-levels-for-github-copilot/)
- Changelog: [GitHub Copilot in Visual Studio Code, May releases](https://github.blog/changelog/2026-06-03-github-copilot-in-visual-studio-code-may-releases/)
- Docs: [Models for GitHub Copilot](https://docs.github.com/en/copilot/concepts/models)
- First-party details:
  - supported models can now run with one-million-token context windows in VS Code, Copilot CLI, and the GitHub Copilot app
  - configurable reasoning levels let users trade off speed, depth, latency, and cost for harder architectural or debugging work
  - the VS Code model picker now exposes reasoning-effort controls directly
  - GitHub also added configurable utility models for titles, summaries, rename suggestions, commit messages, and intent detection
  - BYOK flows now surface real token usage for bring-your-own-key models in the context window
  - GitHub explicitly warns that larger context windows and higher reasoning settings consume more AI credits per interaction
- Latest development checkpoint:
  - GitHub shipped the cross-surface one-million-token and reasoning controls on 2026-06-04, then reinforced them in the 2026-06-03 VS Code May release with model-picker and utility-model routing controls

## Product signal
GitHub is moving model quality, cost, and background-helper routing out of hidden defaults and into visible operator controls that tune the harness per task.
