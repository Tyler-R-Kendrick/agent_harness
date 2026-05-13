# Design Systems And Craft Rule Injection

- Harness: Open Design
- Sourced: 2026-05-13

## What it is
Open Design combines a large library of reusable design systems with a separate universal craft layer, then injects only the relevant sections into the agent context for each skill.

## Evidence
- Official README: [Open Design](https://github.com/nexu-io/open-design)
- Official spec: [skills-protocol.md](https://raw.githubusercontent.com/nexu-io/open-design/main/docs/skills-protocol.md)
- Official release notes: [Open Design 0.6.0](https://github.com/nexu-io/open-design/releases)
- First-party details:
  - the README says Open Design ships 129 built-in design systems
  - skills can declare `design_system.requires` plus specific sections to inject for prompt pruning
  - skills can also declare reusable craft references such as typography, color, and anti-ai-slop rules
  - the 0.6.0 release adds more design systems plus explicit craft rules such as `laws-of-ux` and typography hierarchy guidance
- Latest development checkpoint:
  - the May 9, 2026 `0.6.0` release expands both the design-system catalog and the reusable craft-rule layer, showing this context-assembly model is still evolving quickly

## Product signal
Open Design is making reusable aesthetic context a first-class runtime primitive, not a pile of prompt fragments hidden inside one monolithic system message.
