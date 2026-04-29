import type { ToolSet } from 'ai';
import type { ModelMessage } from '@ai-sdk/provider-utils';
import { buildDefaultToolInstructions, type ToolDescriptor } from '../tools';
import { runToolAgent, type AgentRunResult } from './agentRunner';
import { runLocalToolCallExecutor } from './localToolCallExecutor';
import { resolveExecutionRequirements, taskFromMessages } from './executionRequirements';
import type { IAgentBus } from 'logact';
import type {
  RunToolPlanningAgentOptions,
  ToolAgentRuntime,
  ToolPlan,
  ToolPlanningCallbacks,
} from '../tool-agents/tool-agent';
import { callToolPlan } from '../tool-agents/tool-agent';
import type { BusEntryStep } from '../types';

export interface ExecutorInstructionContext {
  action: string;
  toolPolicy: {
    allowedToolIds: string[];
    assignments: Record<string, string[]>;
  };
  busEntries: BusEntryStep[];
  validationCriteria?: string[];
  bus?: IAgentBus;
}

export async function runConfiguredExecutorAgent(
  options: RunToolPlanningAgentOptions & { runtime: ToolAgentRuntime },
  plan: ToolPlan,
  selectedDescriptors: ToolDescriptor[],
  selectedTools: ToolSet,
  callbacks: ToolPlanningCallbacks,
  executionContext?: ExecutorInstructionContext,
): Promise<AgentRunResult> {
  const toolErrors: string[] = [];
  const executionCallbacks: ToolPlanningCallbacks = {
    ...callbacks,
    onToolResult(toolName, args, result, isError, toolCallId) {
      callbacks.onToolResult?.(toolName, args, result, isError, toolCallId);
      if (isError) {
        toolErrors.push(`${toolName}: ${stringifyResult(result)}`);
      }
    },
  };

  const requirementResolution = await resolveExecutionRequirements({
    runtime: options.runtime,
    plan,
    messages: options.messages,
    executionContext,
    callbacks: executionCallbacks,
  });
  if (requirementResolution.status === 'blocked' || requirementResolution.status === 'fulfilled') {
    if (requirementResolution.status === 'blocked' || !requirementResolution.result.failed) {
      callbacks.onDone?.(requirementResolution.result.text);
    }
    return withToolErrorState(requirementResolution.result, toolErrors);
  }

  if (plan.steps.length > 0) {
    const outputs = await callToolPlan(options.runtime, plan, executionCallbacks, {}, 'execute-plan');
    const blockedResult = resultFromNeedsUserInputOutputs(outputs);
    if (blockedResult) {
      callbacks.onDone?.(blockedResult.text);
      return withToolErrorState(blockedResult, toolErrors);
    }
    const text = JSON.stringify(outputs, null, 2);
    callbacks.onToken?.(text);
    callbacks.onDone?.(text);
    return withToolErrorState({ text, steps: plan.steps.length }, toolErrors);
  }

  const modelProvider = (options.model as { provider?: string }).provider;
  const instructions = buildDefaultToolInstructions({
    workspaceName: options.workspaceName ?? 'Workspace',
    workspacePromptContext: options.instructions,
    descriptors: selectedDescriptors,
    selectedToolIds: selectedDescriptors.map((descriptor) => descriptor.id),
  });
  const executorMessages = buildExecutorMessages(options.messages, plan, executionContext);

  if (modelProvider === 'local') {
    const result = await runLocalToolCallExecutor({
      model: options.model,
      tools: selectedTools,
      toolDescriptors: selectedDescriptors,
      instructions,
      messages: executorMessages,
      signal: options.signal,
      maxSteps: Math.min(options.maxSteps ?? 20, 6),
      maxIterations: 1,
      requireToolUse: false,
      maxToolUseRetries: 0,
    }, {
      ...executionCallbacks,
      // The outer LogAct workflow owns the visible AgentBus for this run.
      onBusEntry: undefined,
      onVoterStep: undefined,
      onVoterStepUpdate: undefined,
      onVoterStepEnd: undefined,
    });
    return withToolErrorState(result, toolErrors);
  }

  const result = await runToolAgent({
    model: options.model,
    tools: selectedTools,
    instructions,
    messages: executorMessages,
    signal: options.signal,
    maxSteps: Math.min(options.maxSteps ?? 6, 6),
  }, { ...executionCallbacks, onToken: undefined, onDone: undefined });

  callbacks.onDone?.(result.text);
  return withToolErrorState({
    ...result,
    steps: result.steps || Math.max(1, plan.steps.length || selectedDescriptors.length),
  }, toolErrors);
}

function resultFromNeedsUserInputOutputs(outputs: Record<string, { output?: unknown; error?: string }>): AgentRunResult | null {
  for (const output of Object.values(outputs)) {
    const result = resultFromNeedsUserInput(output.output, Object.keys(outputs).length);
    if (result) return result;
  }
  return null;
}

function resultFromNeedsUserInput(result: unknown, steps: number): AgentRunResult | null {
  if (!isRecord(result) || result.status !== 'needs_user_input') return null;
  const prompt = typeof result.prompt === 'string' && result.prompt.trim()
    ? result.prompt.trim()
    : 'Please provide the missing information before I continue.';
  return {
    text: prompt,
    steps,
    blocked: true,
    needsUserInput: true,
    elicitation: result,
  };
}

function buildExecutorMessages(
  originalMessages: ModelMessage[],
  plan: ToolPlan,
  executionContext: ExecutorInstructionContext | undefined,
): ModelMessage[] {
  if (!executionContext) return originalMessages;
  const originalTask = taskFromMessages(originalMessages) || plan.goal;
  return [{
    role: 'user',
    content: [
      'Committed LogAct execution plan',
      executionContext.action,
      '',
      'AgentBus context',
      summarizeBusEntries(executionContext.busEntries),
      '',
      `Allowed tools: ${executionContext.toolPolicy.allowedToolIds.join(', ') || '(none)'}`,
      `Original user request: ${originalTask}`,
    ].join('\n'),
  }];
}

function summarizeBusEntries(entries: BusEntryStep[]): string {
  const recentEntries = entries.slice(-12);
  if (recentEntries.length === 0) return '(no AgentBus entries yet)';
  return recentEntries
    .map((entry) => {
      const actor = entry.actorId ?? entry.actor ?? 'agent-bus';
      const detail = entry.detail.length > 240 ? `${entry.detail.slice(0, 237)}...` : entry.detail;
      return `${entry.position + 1}. ${actor} ${entry.summary}: ${detail}`;
    })
    .join('\n');
}

function withToolErrorState(result: AgentRunResult, toolErrors: string[]): AgentRunResult {
  if (toolErrors.length === 0) return result;
  return {
    ...result,
    failed: true,
    error: toolErrors.join('; '),
  };
}

function stringifyResult(result: unknown): string {
  if (typeof result === 'string') return result;
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
