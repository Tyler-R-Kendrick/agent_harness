# Enterprise Model Controls, Spend Limits, And Usage Analytics

- Harness: Cursor
- Sourced: 2026-05-06

## What it is
Cursor now gives enterprise admins a stronger control plane for governing which models and providers agents can use, how spending is limited, and how usage is analyzed across different agent surfaces.

## Evidence
- Official changelog: [Model controls, spend management, and usage analytics](https://cursor.com/changelog/05-04-26)
- First-party details:
  - the May 4, 2026 release adds provider-level and model-level allow or block lists
  - admins can block entire providers or specific model configurations such as speed or context-window variants
  - enterprises can default-block newly released providers or model versions until an admin explicitly allows them
  - Cursor now supports soft spend limits plus automatic alerts when users reach 50%, 80%, and 100% of soft or hard limits
  - the updated analytics tab can break usage down by user and by surface, including clients, Cloud Agents, automations, Bugbot, and Security Review
- Latest development checkpoint:
  - the May 4, 2026 release shows Cursor treating model access and spend as first-class enterprise operating concerns rather than as static account settings

## Product signal
As harnesses add more models, automations, and reviewer agents, enterprise adoption increasingly depends on policy and budget controls that span every agent surface instead of only the primary editor UI.
