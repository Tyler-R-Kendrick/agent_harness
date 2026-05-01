# Mastra Cloud Dashboard And Observability

- Harness: Mastra
- Sourced: 2026-05-01

## What it is
Mastra Cloud packages deployment, dashboards, logs, traces, metrics, scorers, memory inspection, and team-facing debugging into one hosted control plane around the runtime.

## Evidence
- Official docs: [Mastra Cloud overview](https://mastra.ai/docs/mastra-cloud/overview)
- Official site: [Mastra Cloud](https://mastra.ai/cloud)
- Official releases: [mastra-ai/mastra releases](https://github.com/mastra-ai/mastra/releases)
- First-party details:
  - the Mastra Cloud docs say cloud hosting can expose agents, tools, and workflows as REST endpoints and provide a dashboard with deployment status, build logs, and environment settings
  - the cloud page says teams get traces, logs, metrics dashboards, quality scores, datasets, experiments, agent versioning, tool assignment testing, and memory inspection
  - the April 2026 release notes say CloudExporter now ships logs, metrics, scores, and feedback in addition to tracing spans
  - the March 13, 2026 release notes added observability storage schemas and batching upgrades, indicating deeper investment in runtime telemetry
- Latest development checkpoint:
  - current releases are broadening Mastra observability from traces alone into a more complete operator and evaluation surface

## Product signal
Mastra is collapsing deploy, inspect, evaluate, and iterate into one harness-adjacent control plane, which is a strong sign that runtime observability is becoming a product requirement.
