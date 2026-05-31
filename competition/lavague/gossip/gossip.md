# LaVague Gossip

## Positive Signals

- LaVague has public open-source traction, recognizable AI community endorsements, and a clear architecture story around World Model plus Action Engine.
- The QA workflow is concrete enough to be discussed by QA communities: a Gherkin file becomes browser actions and generated Pytest/Selenium.
- TokenCounter addresses a recurring complaint in browser-agent work: teams often do not know what each run costs until the bill arrives.

## Negative Signals

- The docs call LaVague QA an early release and warn that it may contain bugs.
- The QA example documentation says generated final code should be reviewed and that complex or JavaScript-heavy sites can remain difficult.
- GitHub README telemetry notes are sensitive: generated action code, observations, objective, chain-of-thought-like fields, and interaction zones are collected by default unless disabled.

## Category Chatter

- Browser-agent developers are increasingly focused on token cost, deterministic fallback paths, and selector registries.
- QA communities are skeptical of AI-generated test logic when mature Playwright/Selenium patterns already exist.
- Gherkin-to-test generation is attractive for teams with existing BDD artifacts, but it can fail if generated steps diverge from the scenario.

## Bug And UX Risks To Watch

- Generated tests that pass once but encode brittle selectors.
- Mismatch between Gherkin instructions and actual browser actions.
- JavaScript-heavy sites where the agent struggles to identify the right selector.
- Privacy concerns if telemetry defaults are not clearly surfaced during install and CI setup.

## Sources

- https://www.lavague.ai/
- https://github.com/lavague-ai/LaVague
- https://docs.lavague.ai/en/latest/docs/lavague-qa/usage/
- https://docs.lavague.ai/en/docs-updates/docs/examples/qa-automation/
- https://docs.lavague.ai/en/latest/docs/get-started/token-usage/
- https://www.reddit.com/r/LocalLLaMA/comments/1b5k1gp
- https://www.reddit.com/r/developersIndia/comments/1ellnyd
- https://www.reddit.com/r/AI_Agents/comments/1tbeior/browser_based_agents/
