# Fazm Design

## Look And Feel

- Fazm presents as a Mac-native computer agent, not a browser-specific tool.
- The primary interaction is voice: hold a shortcut, speak the task, and the agent operates apps, browser pages, documents, and files.
- Enterprise pages add a team-control layer: workflow library, admin policies, audit logs, role-based access, SSO, and on-prem deployment.
- The design language is local-first and operational: screen data stays on device, workflows are reusable, and every action can be logged.

## Design Tokens To Track

```yaml
surface: macos-desktop-agent-plus-enterprise-admin
accent: local-first-voice-computer-control
primary_control: push-to-talk-command
core_objects:
  - desktop-agent
  - voice-command
  - screen-capture
  - workflow-template
  - audit-log
  - admin-policy
  - app-allowlist
information_density: medium
trust_posture: local-screen-processing-with-policy-and-audit-claims
```

## Differentiators

- Fazm competes above browser automation by controlling the whole desktop: browser, code, documents, Google Apps, files, and native apps.
- Voice-first interaction gives it a different feel from chat-first browser agents and scripted RPA tools.
- The enterprise design makes audit trails, admin controls, workflow sharing, and role-based access first-class selling points.
- Local screen processing is a strong trust signal against cloud browser and cloud-desktop agents.

## What Is Good

- Push-to-talk is a natural command pattern for short desktop tasks.
- Shared workflow templates solve a real team-adoption problem: one person can build and others can run.
- Audit trail and policy controls speak directly to the risk of letting an agent operate business apps.
- Open-source code makes the "local-first" claim easier to inspect.

## Where It Breaks Down

- macOS accessibility, screen capture, code signing, and permissions can be brittle onboarding points.
- Voice is fast when it works, but noisy environments, transcription errors, and command ambiguity can make consequential actions risky.
- Full-desktop control broadens the blast radius beyond browser tabs, so approvals and rollback UX need to be stronger than in a page-only product.
- Teams still need proof that "AI adapts automatically" does not hide silent failures or hard-to-review steps.

## Screenshot References

- GitHub README demos and app structure: `https://github.com/mediar-ai/fazm`
- Enterprise workflow and admin-control page: `https://fazm.ai/enterprise`
