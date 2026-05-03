# Tracker-Native Linear And Jira Agent Control

- Harness: Devin
- Sourced: 2026-05-02

## What it is
Devin can be launched and steered from issue trackers, which makes Linear and Jira act as intake and control surfaces instead of forcing users back into a dedicated agent app for every task.

## Evidence
- Official docs: [Linear Integration](https://docs.devin.ai/product-guides/integrations/linear)
- Official docs: [Jira Integration](https://docs.devin.ai/product-guides/integrations/jira)
- Official docs: [Launch from Ticket Systems](https://docs.devin.ai/product-guides/integrations/ticket-systems)
- First-party details:
  - Devin documents issue-tracker launches as a supported workflow rather than an unofficial webhook trick
  - the integration surface keeps ticket context attached to the session so the task does not need to be retyped into chat
  - the docs present tracker launch as part of normal operational intake across engineering workflows
- Latest development checkpoint:
  - the current docs show Devin continuing to treat Linear and Jira as primary control-plane surfaces for coding work

## Product signal
Devin is following the broader trend that issue systems already contain enough priority and context to become the natural front door for agent execution.
