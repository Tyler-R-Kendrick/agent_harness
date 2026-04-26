import type { ToolSet } from 'ai';
import type { ModelMessage } from '@ai-sdk/provider-utils';
import { buildDefaultToolInstructions, type ToolDescriptor } from '../tools';
import { runToolAgent, type AgentRunResult } from './agentRunner';
import { runLocalToolCallExecutor } from './localToolCallExecutor';
import type {
  RunToolPlanningAgentOptions,
  ToolAgentRuntime,
  ToolPlan,
  ToolPlanningCallbacks,
} from '../tool-agents/tool-agent';
import { callTool, callToolPlan } from '../tool-agents/tool-agent';
import type { BusEntryStep } from '../types';

export interface ExecutorInstructionContext {
  action: string;
  toolPolicy: {
    allowedToolIds: string[];
    assignments: Record<string, string[]>;
  };
  busEntries: BusEntryStep[];
}

type UserContextPrelude =
  | { status: 'continue'; context?: string; steps: number }
  | { status: 'blocked'; result: AgentRunResult };

const USER_CONTEXT_TOOL_IDS = {
  recall: 'webmcp:recall_user_context',
  location: 'webmcp:read_browser_location',
  elicit: 'webmcp:elicit_user_input',
} as const;

function messageContentToText(content: ModelMessage['content']): string {
  if (typeof content === 'string') return content;
  return content
    .map((part) => (part.type === 'text' ? part.text : `[${part.type}]`))
    .join('\n');
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

  const userContextPrelude = await runUserContextPreludeIfNeeded(
    options.runtime,
    plan,
    options.messages,
    executionContext,
    executionCallbacks,
  );
  if (userContextPrelude.status === 'blocked') {
    callbacks.onDone?.(userContextPrelude.result.text);
    return withToolErrorState(userContextPrelude.result, toolErrors);
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

async function runUserContextPreludeIfNeeded(
  runtime: ToolAgentRuntime,
  plan: ToolPlan,
  messages: ModelMessage[],
  executionContext: ExecutorInstructionContext | undefined,
  callbacks: ToolPlanningCallbacks,
): Promise<UserContextPrelude> {
  const taskText = [
    taskFromMessages(messages),
    plan.goal,
    executionContext?.action ?? '',
  ].join('\n');
  if (!isLocationDependentTask(taskText)) {
    return { status: 'continue', steps: 0 };
  }

  const allowedToolIds = new Set([
    ...plan.selectedToolIds,
    ...(executionContext?.toolPolicy.allowedToolIds ?? []),
  ]);
  const hasRequiredTools = Object.values(USER_CONTEXT_TOOL_IDS).every((toolId) => (
    allowedToolIds.has(toolId) && Boolean(runtime.tools[toolId])
  ));
  if (!hasRequiredTools) {
    return { status: 'continue', steps: 0 };
  }

  let steps = 0;
  const recall = await callObservedTool(runtime, USER_CONTEXT_TOOL_IDS.recall, { query: 'location', limit: 5 }, callbacks, ++steps);
  if (hasRecalledLocation(recall)) {
    return { status: 'continue', context: stringifyResult(recall), steps };
  }

  const location = await callObservedTool(runtime, USER_CONTEXT_TOOL_IDS.location, {}, callbacks, ++steps);
  if (hasBrowserLocation(location)) {
    return { status: 'continue', context: stringifyResult(location), steps };
  }

  const elicitation = await callObservedTool(runtime, USER_CONTEXT_TOOL_IDS.elicit, {
    prompt: 'What city or neighborhood should I use to list restaurants near you?',
    reason: 'A location is required before nearby restaurants can be listed.',
    fields: [{
      id: 'location',
      label: 'City or neighborhood',
      required: true,
      placeholder: 'Chicago, IL',
    }],
  }, callbacks, ++steps);
  const blocked = resultFromNeedsUserInput(elicitation, steps);
  if (blocked) {
    return { status: 'blocked', result: blocked };
  }
  return { status: 'continue', steps };
}

async function callObservedTool(
  runtime: ToolAgentRuntime,
  toolId: string,
  args: unknown,
  callbacks: ToolPlanningCallbacks,
  step: number,
): Promise<unknown> {
  const toolCallId = `user-context-${step}`;
  callbacks.onToolCall?.(toolId, args, toolCallId);
  try {
    const result = await callTool(runtime, toolId, args);
    callbacks.onToolResult?.(toolId, args, result, false, toolCallId);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    callbacks.onToolResult?.(toolId, args, message, true, toolCallId);
    return { status: 'unavailable', reason: message };
  }
}

function isLocationDependentTask(text: string): boolean {
  return /\b(near me|nearby|restaurants?|location|city|neighbou?rhood)\b/i.test(text);
}

function hasRecalledLocation(result: unknown): boolean {
  if (!isRecord(result)) return false;
  if (result.status !== 'found') return false;
  return Array.isArray(result.memories) && result.memories.length > 0;
}

function hasBrowserLocation(result: unknown): boolean {
  return isRecord(result) && result.status === 'available';
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

export function taskFromMessages(messages: ModelMessage[]): string {
  const last = messages.at(-1);
  return last ? messageContentToText(last.content) : '';
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
