# Multimodal Media Generation And Hyperframes

- Harness: Open Design
- Sourced: 2026-05-13

## What it is
Open Design extends the design loop beyond static HTML artifacts into image, video, audio, and HTML-to-MP4 generation inside the same workspace.

## Evidence
- Official README: [Open Design](https://github.com/nexu-io/open-design)
- Official release notes: [Open Design 0.6.0](https://github.com/nexu-io/open-design/releases)
- First-party details:
  - the README says image, video, and audio surfaces ship alongside the main design loop
  - supported generation paths include `gpt-image-2`, Seedance 2.0, and HyperFrames
  - the prompt-template gallery includes 93 replicated prompts with preview thumbnails and attribution
  - generated media is written back into the project workspace as real files
  - the 0.6.0 release adds richer HyperFrames previews through the HTML-in-Canvas API
- Latest development checkpoint:
  - the May 9, 2026 `0.6.0` release specifically improves the in-canvas HyperFrames experience, which shows Open Design is still broadening the artifact types its harness can supervise

## Product signal
Open Design is converging artifact generation into one shared runtime so the same agent session can move across UI, slides, imagery, and motion graphics without leaving the harness.
