# Self Hosted Cloud Agents

- Harness: Cursor
- Sourced: 2026-05-01

## What it is
Cursor now lets teams run cloud agents inside their own infrastructure so code, secrets, build artifacts, and tool execution stay on internal machines while Cursor still provides orchestration and UI.

## Evidence
- Official blog: [Run cloud agents in your own infrastructure](https://cursor.com/blog/self-hosted-cloud-agents)
- Official changelog: [Self-hosted Cloud Agents](https://cursor.com/changelog/03-25-26/)
- First-party details:
  - the March 25, 2026 announcement says self-hosted cloud agents keep code and tool execution entirely inside the customer's network
  - Cursor says each cloud agent still gets an isolated remote environment with a terminal, browser, and full desktop
  - the same post says self-hosted workers can be long-lived or single-use and scale through a Helm chart, Kubernetes operator, and fleet API
  - Cursor explicitly frames this as a way to keep the same agent product while swapping the execution plane into enterprise-controlled infrastructure
- Latest development checkpoint:
  - the March 25, 2026 general-availability launch makes this a current enterprise product direction, not only an early access experiment

## Product signal
Cursor is pushing the harness deeper into enterprise execution infrastructure, which raises the bar for any competing browser-agent platform that wants to be taken seriously in regulated environments.
