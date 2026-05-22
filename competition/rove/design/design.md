# Rove Design

## Look And Feel

- Rove uses a concise developer-infrastructure landing page with token-math proof as the central visual argument.
- The page is built around contrast: screenshots to vision models versus accessibility trees to LLMs.
- It uses small code snippets, infrastructure badges, pricing cards, and a "what developers build" section rather than lifestyle marketing.
- The product feels intentionally narrow: hosted Playwright sessions, a11y trees, MCP, recording, and billing.

## Design Tokens Observed

```yaml
visual_language:
  mode: developer_api_infrastructure
  tone: cost_aware_and_practical
  density: medium
  proof_units:
    - tokens_per_page
    - percent_fewer_tokens
    - warm_context_allocation
    - artifact_retention_days
interaction_patterns:
  primary_action: get_100_free_credits
  secondary_action: view_docs
  pricing_unit: credits
  artifact_model:
    - webm_session_recording
    - signed_url
    - seven_day_retention
```

## Differentiators

- The token math is highly legible. Rove makes the cost problem visible before explaining the API.
- Session recording as `.webm` artifacts creates a clear evidence story for debugging agent failures.
- MCP-native positioning lets developers add hosted browser capability to Claude, Cursor, or VS Code without writing integration glue.
- RFC 7807 error responses and warm browser pools make the product feel like serious API infrastructure rather than a demo wrapper.

## Where It Breaks Down

- Accessibility trees reduce token cost but do not replace visual proof for every task; screenshots and video are still needed for design and layout verification.
- Credit-based early-access pricing may recreate the same anxiety the page criticizes in screenshot-token workflows.
- Hosted infrastructure means logged-in or sensitive workflows must be evaluated against data, proxy, retention, and compliance policies.
- Seven-day artifact retention may be too short for teams that need audit trails for long-running investigations.

## Sources

- https://roveapi.com/
- https://status.roveapi.com/
