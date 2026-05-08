# Skyvern Gossip

## Positive Signals

- The public repository has strong open-source traction, with GitHub search results showing roughly 21k stars and frequent releases in 2026.
- Users and docs repeatedly frame Skyvern as a way to avoid brittle selector maintenance by using LLM plus vision reasoning.
- The docs are unusually explicit about artifacts and failure review, which is a positive signal for real production debugging.

## Negative Signals

- GitHub issues show self-hosted authentication/API-key confusion, including misleading 403 errors in the UI.
- Windows setup and quickstart issues recur in public tickets, including async event-loop and Docker/WSL browser creation failures.
- Task execution speed and live-streaming reliability appear in open issues, which matters because browser agents already carry latency risk.

## Bug And UX Risk Themes

- Self-hosting can fail before users reach the product value, especially around ports, Postgres, browser startup, and API-key wiring.
- Persistent session behavior needs to be trustworthy; public issues mention session persistence not being retrieved on subsequent runs.
- A workflow agent with many engine choices can create support complexity when model, proxy, or browser failures look the same to users.

## Sources

- https://www.skyvern.com/docs/developers/getting-started/introduction
- https://www.skyvern.com/docs/running-tasks/api-spec
- https://github.com/Skyvern-AI/skyvern/issues
- https://github.com/Skyvern-AI/skyvern/issues/3782
- https://github.com/Skyvern-AI/skyvern/issues/3546
