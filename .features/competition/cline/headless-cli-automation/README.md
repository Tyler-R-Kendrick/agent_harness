# Headless CLI Automation

- Harness: Cline
- Sourced: 2026-04-30

## What it is
Cline's CLI can run fully headless for scripts, CI/CD pipelines, and non-interactive automation.

## Evidence
- Official docs: [Headless Mode](https://docs.cline.bot/cline-cli/three-core-flows)
- Official docs: [Cline CLI Overview](https://docs.cline.bot/cline-cli/overview)
- First-party details:
  - the docs say headless mode is for automation, scripting, and CI/CD pipelines
  - headless execution can be triggered with `-y`, `--json`, piped stdin, or redirected stdout
  - Cline can emit clean text or JSON output and exit when complete
  - interactive CLI mode also exposes slash commands, settings, file mentions, and Plan/Act toggling

## Product signal
Cline is not just an editor panel. It is also packaging the harness as an automation runtime that can be embedded in developer tooling and CI flows.
