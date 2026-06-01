# Skill Cards And Preinstall Security Scan Provenance

- Harness: OpenClaw
- Sourced: 2026-06-01

## What it is
OpenClaw is making third-party skill trust inspectable before install through generated Skill Cards, registry-backed verification, and visible scan summaries on ClawHub.

## Evidence
- Official docs: [Skills](https://docs.openclaw.ai/tools/skills)
- Official docs: [ClawHub](https://docs.openclaw.ai/clawhub)
- Official product notes: [OpenClaw](https://openclaw.ai/)
- First-party details:
  - `openclaw skills verify <slug>` checks a skill's ClawHub trust envelope, and `--card` prints the generated Skill Card markdown
  - installed ClawHub skills are verified against the source metadata captured in `.clawhub/origin.json`
  - ClawHub skill pages surface the latest security scan state before install, with detail pages for VirusTotal, ClawScan, and static analysis
  - skill installs can fail verification when ClawHub marks them unsafe, and publishers are expected to recover false positives through dashboard or `clawhub skill rescan <slug>`
  - OpenClaw treats generated `skill-card.md` files as registry metadata rather than local prompt instructions or a local hash gate
  - ClawHub tracks versions, tags, changelogs, downloads, stars, and scan summaries so a skill listing doubles as both catalog entry and trust surface
- Latest development checkpoint:
  - the June 1, 2026 product notes say every ClawHub skill now ships with a Skill Card describing what it does and where it came from, and that SkillSpector scanning is part of the release story

## Product signal
OpenClaw is no longer treating skills as opaque prompt bundles. It is building a supply-chain trust layer where provenance, scan status, and human-readable capability cards are part of the install decision.
