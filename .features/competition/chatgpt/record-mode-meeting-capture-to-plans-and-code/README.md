# Record Mode Meeting Capture To Plans And Code

- Harness: ChatGPT
- Sourced: 2026-06-03

## What it is
ChatGPT Record turns meetings, brainstorms, and voice notes into durable canvases and transcripts that can be rewritten into project plans, follow-ups, or even starter code, then reused as context in later conversations.

## Evidence
- Help article: [ChatGPT Record](https://help.openai.com/en/articles/11487532-chatgpt-record/)
- Business release notes: [ChatGPT Business - Release Notes](https://help.openai.com/en/articles/11391654-chatgpt-business-release-notes)
- First-party details:
  - record mode transcribes and summarizes live audio recordings like meetings, brainstorms, or voice notes
  - generated notes are saved as canvases or attached notes and can be rewritten as emails, project plans, or code scaffolds
  - ChatGPT can reference notes and transcripts from past recordings when `Reference record history` is enabled
  - users can pause and resume recording, rename speakers, and delete or upload an in-progress capture
  - workspace owners can disable both Record and `Reference record history`, and Record is off by default for Enterprise and Edu
  - Business release notes position Record as a workspace feature rather than a personal-only capture toy
- Official visuals:
  - the help article includes screenshots of the record button, paused recording state, upload or delete confirmation, and generated-note flow
- Latest development checkpoint:
  - current OpenAI messaging treats live spoken context as a reusable agent input that should survive beyond the initial recording session

## Product signal
ChatGPT is expanding agent intake beyond typed prompts by turning spoken working sessions into structured, reusable context that can feed future plans, tasks, and code generation.
