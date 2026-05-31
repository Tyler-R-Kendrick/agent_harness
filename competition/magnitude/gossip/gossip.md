# Magnitude Gossip

## Positive Signals

- Community discussion around vision-first agents repeatedly frames DOM and selector fragility as a real production pain.
- Magnitude is mentioned in browser-agent comparison chatter as an underrated open-source option, especially because of its WebVoyager claim.
- The API shape is familiar to agent developers: `act`, `extract`, Playwright access, configurable models, and browser context options.

## Negative Signals

- Vision-first products inherit per-step model latency and cost concerns, especially when plain Playwright selectors would have been enough.
- The current public surface does not show a deep governance layer for approvals, replay, secret redaction, or team audit.
- Generic community complaints about browser agents still apply: agents can loop on blocked states, silently misread UI, or spend tokens recovering from bad observations.

## Category Chatter

- Developers are split between vision-first, DOM/accessibility-tree, and hybrid approaches.
- The strongest pro-vision argument is resilience to UI refactors and canvas/mobile surfaces.
- The strongest anti-vision argument is that mature teams already use stable test IDs, page objects, and deterministic automation.

## Bug And UX Risks To Watch

- Mis-clicks on visually similar controls.
- Slow or costly runs when each action requires a model call.
- Ambiguous failures unless screenshots, model observations, and action history are easy to inspect.
- Security risk when natural-language actions run against authenticated browser sessions without explicit permission boundaries.

## Sources

- https://magnitude.run/
- https://docs.magnitude.run/reference/browser-agent
- https://docs.magnitude.run/core-concepts/browser-interaction
- https://docs.magnitude.run/core-concepts/data-extraction
- https://docs.magnitude.run/core-concepts/agent-options
- https://github.com/magnitudedev/magnitude
- https://www.reddit.com/r/AI_Agents/comments/1rq0xhc/what_techniques_actually_move_the_needle_for_browser_or_cua_agents/
- https://www.reddit.com/r/AI_Agents/comments/1slc8rj/tested_6_browser_use_agents_for_realworld_tasks_heres_an_honest_breakdown_looking_for_recommendations/
