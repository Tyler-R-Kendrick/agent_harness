import type { HarnessHookEventDescriptor } from 'harness-core';

export const LOGACT_AGENT_LOOP_HOOK_EVENTS = {
  loopStart: { type: 'agent', name: 'logact.loop.start' },
  loopEnd: { type: 'agent', name: 'logact.loop.end' },
  workflowStart: { type: 'agent', name: 'logact.workflow.start' },
  workflowSnapshot: { type: 'agent', name: 'logact.workflow.snapshot' },
  triggerInput: { type: 'agent', name: 'logact.trigger.input' },
  triggerOutput: { type: 'agent', name: 'logact.trigger.output' },
  driverInput: { type: 'llm', name: 'logact.driver.input' },
  driverOutput: { type: 'llm', name: 'logact.driver.output' },
  voterInput: { type: 'agent', name: 'logact.voter.input' },
  voterOutput: { type: 'agent', name: 'logact.voter.output' },
  deciderInput: { type: 'agent', name: 'logact.decider.input' },
  deciderOutput: { type: 'agent', name: 'logact.decider.output' },
  executorInput: { type: 'llm', name: 'logact.executor.input' },
  executorOutput: { type: 'llm', name: 'logact.executor.output' },
  completionInput: { type: 'agent', name: 'logact.completion.input' },
  completionOutput: { type: 'agent', name: 'logact.completion.output' },
} as const satisfies Record<string, HarnessHookEventDescriptor>;
