# Sub-Agent Coordination And Long-Running Tasks

- Harness: Claude Cowork
- Refreshed: 2026-05-23

## What it is
Cowork is positioned as a task-running harness rather than a short chat surface: it plans work, breaks complex goals into subtasks, coordinates parallel workstreams, and keeps running long enough to produce finished deliverables.

## Evidence
- Official docs: [Get started with Claude Cowork](https://support.claude.com/en/articles/13345190-get-started-with-cowork)
- First-party details:
  - Cowork gives Claude direct local file access, long-running task handling, and deliverable-oriented outputs such as spreadsheets, presentations, and formatted documents
  - Anthropic says Claude analyzes the request, creates a plan, breaks complex work into subtasks, and runs code or shell commands to complete the task
  - the product page frames Cowork as "from delegation to deliverables" for repetitive or messy knowledge work, not just prompt-response chat
- Latest development checkpoint:
  - as of April 9, 2026, Anthropic's current help center positions Cowork's task decomposition and long-running execution as baseline product behavior rather than research-only framing

## Product signal
Anthropic is normalizing supervisor-style task execution for non-coding knowledge work, which broadens the market expectation that agent harnesses should manage internal delegation and durable execution even outside software engineering.
