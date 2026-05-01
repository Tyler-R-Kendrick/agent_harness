# Hierarchical Users Groups And Customware Layers

- Harness: Space Agent
- Sourced: 2026-04-30

## What it is
Space Agent is designed to grow from a personal assistant into a shared multi-user system with user-specific and group-shared layers of behavior and tooling.

## Evidence
- Official README: [agent0ai/space-agent](https://github.com/agent0ai/space-agent)
- Official product site: [space-agent.ai login](https://space-agent.ai/login)
- Official runtime params: [commands/params.yaml](https://raw.githubusercontent.com/agent0ai/space-agent/main/commands/params.yaml)
- First-party details:
  - the README says Space Agent can organize into a hierarchical system of users and groups as scope grows
  - the same page says users can build in their own layer without affecting anyone else, then groups can share tools, workflows, and behavior across teams
  - the hosted login page says self-hosting is designed for multi-user setups, including group management
  - the runtime params expose `CUSTOMWARE_PATH`, `SINGLE_USER_APP`, `LOGIN_ALLOWED`, and `ALLOW_GUEST_USERS`, which points to an explicit product model for layered tenancy and self-hosted control
- Latest development checkpoint:
  - the current public app still exposes guest access and self-hosted multi-user positioning, which shows the team/shared deployment model is active product surface rather than future roadmap copy

## Product signal
Space Agent pushes beyond single-user chat toward layered shared customware, which is highly relevant for team-owned agents and governed workflow reuse.
