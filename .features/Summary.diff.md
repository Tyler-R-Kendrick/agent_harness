# Summary Diff For Linear Feature Generation

Updated: 2026-05-02
Baseline: `.features/Summary.md` updated from the 2026-05-02 nineteen-harness corpus.
Diff type: additive update after Devin research

## Net new normalized features

### Added: Review-native pull request understanding
- Why now: Devin is explicitly shipping a dedicated review product that groups and explains a PR after the code has already been generated, which is a stronger answer to reviewer overload than leaving humans alone with raw diffs.
- Research delta:
  - the Devin Review docs describe a dedicated review workflow instead of a generic chat follow-up
  - Devin says the review surface groups related changes and summarizes intent so reviewers can reason about a patch at a higher level than line-by-line diff noise
  - the March 6, 2026 release notes call out improved copy or move detection and richer PR context, which shows active investment in review quality rather than only generation quality

### Added: Repository-grounded wiki generation and architecture views
- Why now: Devin DeepWiki turns codebase understanding into a durable product artifact with repository maps and architecture diagrams instead of recomputing orientation from scratch in every session.
- Research delta:
  - the DeepWiki docs present a standing repository wiki rather than a one-off generated report
  - Devin exposes repository maps and architecture diagrams as part of the same code-grounded knowledge surface
  - the product positions the wiki as navigable alongside active coding work, which makes repo understanding reusable across sessions and across users

### Expanded: Parallel agent orchestration
- Why now: Devin's current docs no longer treat multi-agent work as an accidental workaround; managed child sessions and Advanced Mode make it a formal orchestration pattern.
- Research delta:
  - the January 22, 2026 release introduced child sessions plus session-origin tracking
  - the February 3, 2026 release added structured output for child sessions
  - the Advanced Mode docs explicitly describe orchestrating managed Devins in parallel

### Expanded: Skills, plugins, and reusable workflow packaging
- Why now: Devin is maturing workflow packaging beyond reusable prompt text through playbook macros, version history, and community distribution.
- Research delta:
  - the Playbooks docs frame workflows as reusable team assets
  - the March 20, 2026 release added playbook macros
  - the April 18, 2026 release added playbook version history

### Expanded: External tool connectivity and actionability
- Why now: Devin is moving beyond raw MCP compatibility toward a real install and deployment surface.
- Research delta:
  - the April 7, 2026 release added an MCP marketplace
  - the April 18, 2026 release added custom transports for remote MCP servers
  - Devin's API and ACP work reinforce that external clients can orchestrate sessions programmatically

### Added: Build review-native PR understanding for browser-agent changes
- Why now: `agent-browser` can produce diffs and evidence, but it still lacks a dedicated review surface that helps another human or agent understand the patch at the semantic level before approving or requesting follow-up work.
- Linear issue title:
  - `Build review-native PR understanding for browser-agent changes`
- Suggested problem statement:
  - `agent-browser` can generate diffs, test logs, and browser evidence, but reviewers still have to reconstruct the narrative and risk profile from low-level artifacts instead of getting a structured, review-native understanding of what changed and why.
- One-shot instruction for an LLM:
  - Implement a review-native PR understanding surface for `agent-browser` that groups related changes, summarizes intent, highlights likely risks, links validation and browser evidence, and supports comment-driven follow-up runs or reviewer requests without forcing users back into raw diff-only review.

### Added: Generate repository-grounded wiki and architecture views for browser-agent projects
- Why now: `agent-browser` still re-derives too much repo orientation inside individual sessions, while Devin shows the value of a standing, refreshable codebase wiki that both people and agents can cite during work.
- Linear issue title:
  - `Generate repository-grounded wiki and architecture views for browser-agent projects`
- Suggested problem statement:
  - `agent-browser` lacks a durable, repo-grounded knowledge surface for codebase maps, architecture views, and onboarding guidance, so each new run or reviewer often has to rebuild the same orientation context from scratch.
- One-shot instruction for an LLM:
  - Build a repository-grounded wiki system for `agent-browser` that scans the current project, generates refreshable codebase maps and architecture diagrams, stores grounded explanations as durable artifacts, and lets agent runs cite, open, and update those views during planning, implementation, and review.

## How to use this file

1. Treat each `Added:` section as a candidate Linear epic or feature.
2. Convert the `Linear issue title` into the issue title.
3. Use the `Suggested problem statement` as the issue body opener.
4. Paste the `One-shot instruction for an LLM` into implementation planning or issue enrichment.

## Recommended next Linear batch

1. `Build review-native PR understanding for browser-agent changes`
2. `Generate repository-grounded wiki and architecture views for browser-agent projects`
