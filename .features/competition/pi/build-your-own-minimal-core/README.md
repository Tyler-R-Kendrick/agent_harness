# Build-Your-Own Minimal Core

- Harness: Pi
- Sourced: 2026-04-30

## What it is
Pi positions itself as a deliberately minimal terminal coding harness that avoids baking in workflow opinions and instead expects users to assemble the behaviors they want through packages, skills, extensions, prompts, and themes.

## Evidence
- Official coding-agent README: [packages/coding-agent/README.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md)
- First-party details:
  - the README says Pi is a "minimal terminal coding harness" that users should adapt to their own workflows
  - the same page says Pi intentionally skips built-in subagents, plan mode, permission popups, to-dos, and background bash so those choices can be handled by packages or external tools
  - the default tool surface is intentionally small: `read`, `write`, `edit`, and `bash`
- Latest development checkpoint:
  - the public repo and releases page show Pi continuing to evolve quickly through late April 2026, but the core product stance remains "small default surface, extensible everywhere else"

## Product signal
Pi is an explicit counter-position to feature-heavy harnesses: keep the core narrow, make extension seams first-class, and let teams construct their own operating model instead of accepting a vendor-defined workflow.
