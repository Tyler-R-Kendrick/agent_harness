# harness-core

Reusable TypeScript agent-loop primitives for `agent_harness`.

The package follows the parts of Pi's agent core that are useful outside a TUI:
typed messages, lifecycle events, stateful queues, awaited subscribers, a
low-level loop runner, and a LogAct adapter used by Agent Browser.

## Default commands

`createDefaultCommandRegistry()` and `createHarnessExtensionContext()` include:

- `/help [command]` for command discovery.
- `/update` for a supplied harness update handler, or an unavailable status when none is configured.
- `/config [key|key=value]` for in-memory setting reads and writes.
- `/version` for the current `harness-core` version.
- `tool:<tool-name>(<param>=<value>, ...)` for direct invocation of registered tools.
