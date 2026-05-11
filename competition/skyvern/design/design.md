# Skyvern Design

## Look And Feel

- Documentation-first developer product with a heavy API reference surface, quickstarts, and explicit run/task objects.
- The product design centers on "describe a workflow, watch a real Chromium browser complete it" rather than a consumer browser chrome.
- The UI and docs emphasize recordings, screenshots, logs, timeline artifacts, persistent browser sessions, and workflow publishing.

## Design Tokens To Track

```yaml
surface: developer docs, cloud run dashboard, open-source repo
accent: workflow automation, LLM plus computer vision, real browser execution
primary_control: prompt plus optional URL, engine, max steps, webhook, browser session
core_objects:
  - run
  - task
  - workflow
  - browser session
  - browser profile
  - recording
  - screenshot
  - failure reason
  - webhook
information_density: high
trust_controls:
  - max_steps
  - error_code_mapping
  - include_action_history_in_verification
  - artifact review
```

## Differentiators

- Skyvern pairs LLM reasoning with computer vision and DOM context so it can attempt websites it has not seen before.
- The API exposes run artifacts as first-class outputs: recordings, final screenshots, downloaded files, run timelines, and failure reasons.
- Workflow publishing and persistent browser sessions move the product beyond one-off prompt execution toward repeatable automations.
- Open-source availability gives developers a self-hosting and inspection path that pure hosted platforms do not provide.

## What Is Good

- The run object is explicit and operationally useful: status, timestamps, output, artifacts, browser session IDs, and failure state are visible.
- Max-step limits, webhook callbacks, persistent sessions, and engine selection give teams concrete levers for production control.
- The docs acknowledge failure modes and direct users to artifacts and timelines instead of treating agent failure as opaque.

## Where It Breaks Down

- The developer experience can become infrastructure-heavy: self-hosting involves backend, frontend, database, browser, and provider credentials.
- Many controls are exposed as API options, which is powerful for engineers but less ergonomic for nontechnical workflow builders.
- Community issues show setup and authentication errors can be confusing, especially in self-hosted and Windows environments.

## Screenshot And Design Studio References

- Run/task API and artifact model: https://www.skyvern.com/docs/running-tasks/api-spec
- API reference shape: https://www.skyvern.com/docs/api-reference/api-reference/agent/run-task
- Self-hosted product surface and repository: https://github.com/Skyvern-AI/skyvern
