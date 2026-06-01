# Extension Packages

`ext/` contains installable extension packages that layer optional IDE, harness,
and provider behaviors onto the core Agent Harness runtime.

Use the package README linked below for the public API surface, setup details,
and focused validation commands for each extension.

## Harness extensions

| Package | Purpose |
|---|---|
| [`ext/harness/agent-skills/README.md`](./harness/agent-skills/README.md) `@agent-harness/ext-agent-skills` | Loads checked-in agent-skills assets into an Agent Harness session. |
| [`ext/harness/agents-md/README.md`](./harness/agents-md/README.md) `@agent-harness/ext-agents-md` | Exposes `AGENTS.md` workspace instruction assets as an optional harness plugin. |
| [`ext/harness/live-share/README.md`](./harness/live-share/README.md) `@agent-harness/ext-live-share` | Adds policy-gated collaborative session control over WebRTC. |

## IDE extensions

| Package | Purpose |
|---|---|
| [`ext/ide/artifacts/README.md`](./ide/artifacts/README.md) `@agent-harness/ext-artifacts` | Default Claude-style artifact plugin for Agent Harness IDE sessions. |
| [`ext/ide/design-md/README.md`](./ide/design-md/README.md) `@agent-harness/ext-design-md` | Loads `DESIGN.md` design-token assets into the workspace. |
| [`ext/ide/design-studio/README.md`](./ide/design-studio/README.md) `@agent-harness/ext-design-studio` | Adds Design Studio project artifact support built around `DESIGN.md`. |
| [`ext/ide/hyperframes/README.md`](./ide/hyperframes/README.md) `@agent-harness/ext-hyperframes` | Provides the HyperFrames editor pane, config sidebar, and generated preview artifacts. |
| [`ext/ide/markdown-mermaid/README.md`](./ide/markdown-mermaid/README.md) `@agent-harness/ext-markdown-mermaid` | Renders Markdown and MDX artifacts with Mermaid diagram support. |
| [`ext/ide/markdown-preview/README.md`](./ide/markdown-preview/README.md) `@agent-harness/ext-markdown-preview` | Default Markdown and MDX artifact preview renderer. |
| [`ext/ide/workflow-canvas/README.md`](./ide/workflow-canvas/README.md) `@agent-harness/ext-workflow-canvas` | Adds CNCF Serverless Workflow canvas orchestration to the IDE surface. |

## Provider extensions

| Package | Purpose |
|---|---|
| [`ext/provider/local-model-connector/README.md`](./provider/local-model-connector/README.md) `@agent-harness/ext-local-model-connector` | Browser extension and PWA client assets for approved local OpenAI-compatible endpoints. |

## Notes

- The workspaces above are the current public `ext/*/*` packages in this
  repository.
- `ext/ide/workflow-canvas-tests` is intentionally excluded here because it is a
  private test workspace rather than a package intended for reuse.
