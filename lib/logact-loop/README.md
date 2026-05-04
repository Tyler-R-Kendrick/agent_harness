# @agent-harness/logact-loop

LogAct workflow extension for the generic `harness-core` agent event loop.

`harness-core` owns the event-loop kernel: serializable workflow states,
registered event actors, registered event publishers, and lifecycle events.
This package owns the LogAct orchestration that maps that generic runtime to the
driver, voter, decider, executor, and completion-checker roles.
