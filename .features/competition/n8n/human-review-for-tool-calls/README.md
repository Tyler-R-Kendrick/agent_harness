# Human Review For Tool Calls

- Harness: n8n
- Sourced: 2026-05-10

## What it is
n8n can require a human to approve or deny selected tool calls before an agent executes them.

## Evidence
- Official docs: [Human-in-the-loop for AI tool calls](https://docs.n8n.io/advanced-ai/human-in-the-loop-tools/)
- Official docs: [Advanced AI](https://n8n.io/ai/)
- First-party details:
  - human review can apply to all connected tools or only selected tools
  - when review is enabled, the workflow pauses and sends an approval request through Slack, Telegram, or n8n Chat
  - the reviewer sees the proposed tool and parameters before allowing or blocking execution
  - n8n markets human approvals as part of the default AI operating model, alongside integrations and code
- Latest development checkpoint:
  - current docs emphasize per-tool human review as a more precise control than coarse output gating

## Product signal
n8n is pushing approval down to the action level, which is a stronger guardrail than generic confirm-or-cancel prompts around the whole run.
