# Sessions, Sharing, And Forkable Handoffs

- Harness: Kilo Code
- Sourced: 2026-05-07

## What it is
Kilo treats the session as a platform-agnostic object that can move between CLI, cloud, and IDE surfaces, then be shared read-only or forked into a new private run.

## Evidence
- Official docs: [Sessions & Sharing](https://kilo.ai/docs/collaborate/sessions-sharing)
- Official docs: [Collaborate overview](https://kilo.ai/docs/collaborate)
- First-party details:
  - Kilo says a session remembers the repository, the task, the conversation, and optional git context
  - users can resume the same session later without restating the task
  - shared links are read-only and expose safe "open in editor" or CLI actions for collaborators
  - recipients can fork a shared session with `kilocode --fork SHARE_ID` or `/session fork SHARE_ID`
  - the collaborate docs say sessions can be created from the CLI, Cloud Agent, or IDE extensions
- Latest development checkpoint:
  - the current docs frame session portability itself as a feature boundary, which puts continuity and handoff on the same level as model or tool choice

## Product signal
Kilo is leaning into runs as reusable collaboration artifacts, where the valuable unit is not only the transcript but the resumable context package around the task.