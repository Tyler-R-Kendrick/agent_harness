# Multi-Cli Agent Runtime And Byok Proxy

- Harness: Open Design
- Sourced: 2026-05-13

## What it is
Open Design does not ship one proprietary agent runtime; it auto-detects many existing coding-agent CLIs, runs them inside a local daemon, and falls back to a normalized BYOK proxy when no local CLI is available.

## Evidence
- Official README: [Open Design](https://github.com/nexu-io/open-design)
- First-party details:
  - the README says 16 coding-agent CLIs are auto-detected on `PATH`
  - the local daemon spawns the chosen CLI in the project folder with real filesystem and shell access
  - the runtime includes Windows-specific fallbacks for long command lines
  - if no CLI is installed, the product can proxy Anthropic, OpenAI-compatible, Azure OpenAI, or Google Gemini APIs through a normalized stream path
  - the daemon rejects non-loopback private and redirect targets at the edge to reduce SSRF risk
- Latest development checkpoint:
  - the May 2026 README still treats agent portability and BYOK routing as a headline differentiator, which suggests Open Design is deliberately competing on harness openness rather than model lock-in

## Product signal
Open Design is turning the harness into a stable control plane above interchangeable agent engines instead of tying the UX to one vendor model or one local CLI.
