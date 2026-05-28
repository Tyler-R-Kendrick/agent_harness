# Vibot Gossip

## Positive Signals

- Vibot names real operational needs that category users complain about: retries, scheduling, monitoring, extraction plans, and running workflows after the demo.
- Self-hosting and local LLM support appeal to teams that distrust cloud browser agents with credentials and internal apps.
- The product recognizes that browser automation is not only clicking; monitoring, data export, webhooks, and health metrics matter.

## Negative Signals

- The breadth of features creates maintenance risk for a young open-source project.
- If the dashboard, CLI, MCP router, and agent runner each have separate failure modes, setup can become harder than a hosted browser API.
- Multi-agent concurrency sounds powerful but raises questions about browser isolation, resource use, and deterministic replay.

## Category Chatter

- Browser automation practitioners repeatedly warn that layout changes, anti-bot systems, auth persistence, and human approvals are where demos fail.
- Developers want stable execution layers and observability more than another thin AI wrapper.
- Self-hosted products win data-sovereignty arguments but lose buyers who do not want operational burden.

## Bug And UX Risks To Watch

- Visual workflow changes should remain diffable and testable; opaque graph state can be hard to review.
- Cron jobs need clear run history, screenshots, logs, and failed-step artifacts.
- MCP routing needs predictable permission boundaries when many agents can call the same browser tools.

## Sources

- https://vibot.app/
- https://www.reddit.com/r/AI_Agents/comments/1subsl4/we_spent_3_months_building_an_ai_agent_for/
- https://www.reddit.com/r/vibecoding/comments/1t7blju/browserapi_an_api_for_building_ai_agents_that_can/
