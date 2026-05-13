# Sandboxed Artifact Preview And Multi-Format Export

- Harness: Open Design
- Sourced: 2026-05-13

## What it is
Open Design renders generated artifacts in a sandboxed preview surface and couples that preview with direct export paths instead of leaving outputs trapped in the transcript.

## Evidence
- Official README: [Open Design](https://github.com/nexu-io/open-design)
- Official release notes: [Open Design 0.6.0](https://github.com/nexu-io/open-design/releases)
- First-party details:
  - the README says every artifact renders in a clean `srcdoc` iframe
  - users can edit artifacts in place through the file workspace
  - built-in export paths include HTML, PDF, ZIP, and deck-oriented outputs such as PPTX flows
  - the 0.6.0 release adds direct PDF export so users no longer need print-to-PDF workarounds
  - packaged builds gained better inspect-overlay support and child-window preview handling for live artifacts
- Latest development checkpoint:
  - the May 9, 2026 `0.6.0` release materially improves artifact export and preview handling, which suggests the artifact surface is still an active differentiator

## Product signal
Open Design treats the artifact as the real product output and the chat as the control surface around it.
