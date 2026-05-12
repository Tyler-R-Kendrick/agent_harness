# Conductor Json Shared Repo Scripts And Privacy

- Harness: Conductor
- Sourced: 2026-05-12

## What it is
Conductor uses a repo-owned `conductor.json` contract to define shared scripts, workflow behavior, and privacy-related controls for the workspace lifecycle.

## Evidence
- Official docs: [conductor.json](https://www.conductor.build/docs/reference/conductor-json)
- Official docs: [Checks tab](https://www.conductor.build/docs/reference/checks-tab)
- First-party details:
  - `conductor.json` configures shared scripts that power setup, checks, and other workspace actions
  - the file is meant to live with the repository and travel with the project
  - the reference docs also cover privacy controls and sharing-related settings in the same repo-owned contract
- Latest development checkpoint:
  - the current docs continue to center `conductor.json` as the way teams standardize how the harness behaves inside their repository

## Product signal
This is part of a broader move toward version-controlled harness behavior, where teams want repo-owned operational contracts instead of hidden local settings.
