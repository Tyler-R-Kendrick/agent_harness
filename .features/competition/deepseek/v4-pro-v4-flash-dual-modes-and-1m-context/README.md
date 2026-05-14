# V4 Pro, V4 Flash, Dual Modes, And 1M Context

- Harness: DeepSeek
- Sourced: 2026-05-14

## What it is
DeepSeek's current flagship surface is a two-tier runtime: `DeepSeek-V4-Pro` for heavier reasoning and `DeepSeek-V4-Flash` for faster, cheaper execution, both exposed across web, app, and API with a shared 1M-token context window and explicit Thinking versus Non-Thinking modes.

## Evidence
- Official release: [DeepSeek V4 Preview Release](https://api-docs.deepseek.com/news/news260424)
- First-party details:
  - the April 24, 2026 release says `DeepSeek-V4-Pro` and `DeepSeek-V4-Flash` are live on chat, app, and API
  - the same release says users can switch between `Expert Mode` and `Instant Mode` at `chat.deepseek.com`
  - DeepSeek says `1M context is now the default across all official DeepSeek services`
  - the release positions V4-Pro as stronger on agentic coding benchmarks and V4-Flash as near-parity on simpler agent tasks at lower cost
- Latest development checkpoint:
  - this is a live April 24, 2026 platform release, so the dual-tier model surface and 1M-context posture are current, not historical

## Product signal
DeepSeek is making runtime class, reasoning depth, and long-context budget first-class operator choices instead of hiding them behind one generic chat entrypoint.
