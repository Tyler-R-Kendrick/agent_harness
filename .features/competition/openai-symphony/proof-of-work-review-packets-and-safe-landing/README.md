# Proof-Of-Work Review Packets And Safe Landing

- Harness: OpenAI Symphony
- Sourced: 2026-04-30

## What it is
Symphony emphasizes reviewable output packages rather than raw agent transcripts, including validation evidence and support for landing changes safely.

## Evidence
- Official announcement: [An open-source spec for Codex orchestration: Symphony](https://openai.com/index/open-source-codex-orchestration-symphony/)
- Repository overview: [README.md](https://github.com/openai/symphony/blob/main/README.md)
- First-party details:
  - the repo README says agents provide proof of work including CI status, PR review feedback, complexity analysis, and walkthrough videos
  - the announcement says product managers and designers can file feature requests and receive a review packet with a video walkthrough of the feature working in the real product
  - the announcement says Symphony watches CI, rebases when needed, resolves conflicts, retries flaky checks, and shepherds work through the merge pipeline
  - accepted work can be landed without engineers manually babysitting each step
- Media provided:
  - Demo poster: ![Symphony demo poster](https://raw.githubusercontent.com/openai/symphony/main/.github/media/symphony-demo-poster.jpg)
  - Demo video: [symphony-demo.mp4](https://raw.githubusercontent.com/openai/symphony/main/.github/media/symphony-demo.mp4)
- Latest development checkpoint:
  - the public launch on April 27, 2026 presented proof-of-work artifacts as a primary output of the system, not an optional add-on

## Product signal
Symphony reinforces the shift from chat answers toward evidence-backed delivery packets that make autonomous work easier to review, approve, and land.
