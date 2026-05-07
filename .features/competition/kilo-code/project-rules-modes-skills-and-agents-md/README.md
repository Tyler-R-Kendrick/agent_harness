# Project Rules, Modes, Skills, And `agents.md`

- Harness: Kilo Code
- Sourced: 2026-05-07

## What it is
Kilo lets teams shape agent behavior through multiple repo and user-level configuration layers, including custom modes, rules, instructions, skills, and `agents.md`.

## Evidence
- Official docs: [Customize overview](https://kilo.ai/docs/customize)
- Official docs: [Code with AI](https://kilo.ai/docs/code-with-ai)
- Official marketplace repo: [Kilo Marketplace](https://github.com/Kilo-Org/kilo-marketplace)
- First-party details:
  - the customize docs list custom modes, custom rules, custom instructions, custom subagents, `agents.md`, workflows, and skills as first-class surfaces
  - Kilo says `agents.md` can store project context, decisions, and important information
  - the marketplace repo defines three reusable extension units: skills, MCP servers, and modes
  - the marketplace positions skills as self-contained, shareable, interoperable packages with optional scripts and references
  - the marketplace says modes can define role, tool access, file restrictions, and custom instructions
- Latest development checkpoint:
  - Kilo is no longer limiting customization to a single rules file; it is building a layered packaging model that mixes repo policy, reusable workflows, and installable agent extensions

## Product signal
Kilo is betting that durable team adoption comes from configurable agent contracts and reusable packages, not only from a strong default prompt.