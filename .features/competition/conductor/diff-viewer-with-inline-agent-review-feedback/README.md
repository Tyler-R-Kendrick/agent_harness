# Diff Viewer With Inline Agent Review Feedback

- Harness: Conductor
- Sourced: 2026-05-12

## What it is
Conductor has a dedicated diff review surface where users can inspect changes, leave inline comments, and route review feedback back into the agent workflow without dropping to raw git tooling first.

## Evidence
- Official docs: [Diff viewer](https://www.conductor.build/docs/reference/diff-viewer)
- Official docs: [Issue to PR](https://www.conductor.build/docs/guides/issue-to-pr)
- First-party details:
  - the diff viewer is a first-class workspace surface rather than only an exported patch
  - users can comment on diffs inline and feed those comments back into the agent loop
  - the review flow sits directly between implementation and pull-request creation
- Latest development checkpoint:
  - the docs continue to position inline diff review as part of the normal Conductor delivery loop instead of an afterthought

## Product signal
This reinforces the shift from agent-as-chatbot toward agent-as-change-author, where reviewer comprehension and structured follow-up matter as much as raw code generation.
