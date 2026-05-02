# Sandbox Providers And Kubernetes Isolation

- Harness: OpenHands
- Sourced: 2026-05-02

## What it is
OpenHands exposes multiple execution environments for agent work: Docker sandbox, process sandbox, and remote sandbox. Its control-plane guidance further recommends Kubernetes-hosted isolated containers for scaled deployments.

## Evidence
- Official docs: [Sandbox Configuration Overview](https://docs.openhands.dev/openhands/usage/sandboxes/overview)
- Official blog: [The Software Agent Control Plane](https://openhands.dev/blog/agent-control-plane)
- First-party details:
  - the V1 docs say OpenHands can run work inside Docker, a local process, or a remote sandbox
  - Docker is the recommended provider because it isolates the host machine
  - the control-plane post says OpenHands encourages Kubernetes-based runtimes, with each agent running inside its own container on cloud infrastructure
  - OpenHands says its runtime container can include language tooling, `tmux`, and a Chromium browser
- Latest development checkpoint:
  - the April 3, 2026 control-plane post reframed isolated runtime environments as part of a broader software-agent stack rather than a hidden implementation detail

## Product signal
OpenHands treats execution environment choice as a product surface. That matters because safe scale depends on isolation, reproducibility, and clear tradeoffs between local speed and remote governance.
