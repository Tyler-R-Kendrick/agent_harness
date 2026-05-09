# Task Todo Lists And Architect Planning

- Harness: Roo Code
- Sourced: 2026-05-09

## What it is
Roo embeds persistent task checklists directly into the conversation and auto-creates them for multi-step work, especially when users work through planning-heavy modes.

## Evidence
- Official docs: [Task Todo List](https://docs.roocode.com/features/task-todo-list)
- First-party details:
  - Roo creates interactive, persistent checklists inside the chat interface
  - todo lists are automatically created for complex tasks, multi-step workflows, or Architect mode
  - users can also ask Roo to invoke the `update_todo_list` tool manually
  - the checklist shows item status and lets the AI mark items complete as work progresses
- Latest development checkpoint:
  - Roo documents todo creation as a default behavior for higher-complexity tasks, which shows planning state being pulled into the main execution surface instead of being left to ad hoc prose

## Product signal
Roo is treating plan state as a first-class runtime artifact that the user and agent co-edit in the same thread.
