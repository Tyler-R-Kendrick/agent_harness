import type { LanguageModel, ToolSet } from 'ai';
import type { ModelMessage } from '@ai-sdk/provider-utils';
import type { ICompletionChecker, IVoter } from 'logact';
import type { LanguageModelV3GenerateResult, LanguageModelV3StreamPart } from '@ai-sdk/provider';
import { runToolAgent, type AgentRunCallbacks, type AgentRunResult } from './agentRunner';
import { runLocalToolCallExecutor } from './localToolCallExecutor';
import { runAgentLoop } from '../chat-agents/agent-loop';
import type { AgentStreamCallbacks } from '../chat-agents/types';
import { buildAgentSystemPrompt, buildToolInstructionsTemplate, buildToolGroupSelectionPrompt, buildToolRouterPrompt, buildToolSelectorPrompt, resolveAgentScenario } from './agentPromptTemplates';
import { createPromptBudget, fitTextToTokenBudget, type BudgetedMessage } from './promptBudget';
import type { ModelCapabilities } from './agentProvider';
import { createHeuristicCompletionChecker, isExecutionTask } from 'ralph-loop';
import {
  createMustUseToolVoter,
  createNoPlanOnlyVoter,
  createMustExecuteCompletionChecker,
} from './toolUseVoters';
import {
  buildToolGroupDescriptors,
  selectToolDescriptorsByIds,
  selectToolsByIds,
  type ToolDescriptor,
  type ToolGroupDescriptor,
} from '../tools';
import type { BusEntryStep } from '../types';
import { createObservedBus } from './observedAgentBus';

const ROUTER_OUTPUT_TOKENS = 96;
const GROUP_SELECTOR_OUTPUT_TOKENS = 96;
const TOOL_SELECTOR_OUTPUT_TOKENS = 192;

// Local thinking-model default sampling (Qwen3 non-thinking recommended values).
// Remote providers ignore this — it's scoped to `providerOptions.local`.
const LOCAL_STAGE_PROVIDER_OPTIONS = {
  local: {
    enableThinking: false,
    topK: 20,
    minP: 0,
  },
} as const;

// Upper bound for steps when planning drives a local thinking model end-to-end.
// Keeps the executor from looping for minutes if the model stalls mid-plan.
const LOCAL_EXECUTOR_MAX_STEPS = 6;

type StageName = 'router' | 'group-select' | 'tool-select' | 'executor' | 'chat';

export type StagedToolPipelineOptions = {
  model: LanguageModel;
  tools: ToolSet;
  toolDescriptors: ToolDescriptor[];
  instructions: string;
  messages: ModelMessage[];
  workspaceName?: string;
  capabilities: Pick<ModelCapabilities, 'contextWindow' | 'maxOutputTokens'>;
  signal?: AbortSignal;
  maxSteps?: number;
  maxGroups?: number;
  maxTools?: number;
  completionChecker?: ICompletionChecker;
  maxIterations?: number;
  /**
   * Optional LogAct voters. When provided, the executor phase runs inside
   * `runAgentLoop` so each tool intent is driven through the shared Driver →
   * Voter(s) → Decider → Executor flow and voter thoughts are surfaced
   * through the voter-step callbacks — unifying the tool path with the plain
   * chat path.
   */
  voters?: IVoter[];
};

export type StagedToolPipelineCallbacks = AgentRunCallbacks
  & Pick<AgentStreamCallbacks,
    'onVoterStep'
    | 'onVoterStepUpdate'
    | 'onVoterStepEnd'
    | 'onIterationStep'
    | 'onIterationStepUpdate'
    | 'onIterationStepEnd'
  >
  & {
    /** Fired for every entry appended to the underlying observed AgentBus. */
    onBusEntry?: (entry: BusEntryStep) => void;
    /** Fired when an inference turn (one model generation pass) starts. */
    onModelTurnStart?: (turnId: string, stepIndex: number) => void;
    /** Fired when a turn completes, with parsed `<tool_call>` if any. */
    onModelTurnEnd?: (
      turnId: string,
      text: string,
      parsedToolCall: { toolName: string; args: Record<string, unknown> } | null,
    ) => void;
    /**
     * Stage lifecycle callbacks. The optional `subStageId` / `parentStageId`
     * pair lets a single `StageName` (e.g. `'tool-select'`) fan out into
     * multiple parallel sub-stages — one per ToolGroupDescriptor — each with
     * its own ProcessLog row, watchdog entry, and render branch under the
     * shared parent.
     */
    onStageStart?: (
      stage: StageName,
      detail: string,
      meta?: { subStageId?: string; parentStageId?: string; label?: string },
    ) => void;
    onStageToken?: (
      stage: StageName,
      delta: string,
      meta?: { subStageId?: string; parentStageId?: string },
    ) => void;
    onStageComplete?: (
      stage: StageName,
      text: string,
      meta?: { subStageId?: string; parentStageId?: string },
    ) => void;
    onStageError?: (
      stage: StageName,
      error: Error,
      meta?: { subStageId?: string; parentStageId?: string },
    ) => void;
  };

type StageJson = {
  mode?: string;
  goal?: string;
  groups?: string[];
  toolIds?: string[];
};

type StreamableModel = {
  doGenerate?: (options: unknown) => Promise<LanguageModelV3GenerateResult>;
  doStream?: (options: unknown) => Promise<{ stream: ReadableStream<LanguageModelV3StreamPart> }>;
};

const OPEN_THINK_TAG = '<think>';
const CLOSE_THINK_TAG = '</think>';

function stripThinkBlocks(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();
}

function createThinkBlockSanitizer() {
  let buffer = '';
  let inThink = false;

  return {
    push(chunk: string): string {
      if (!chunk) return '';

      buffer += chunk;
      let output = '';

      while (buffer.length > 0) {
        if (inThink) {
          const closeIndex = buffer.indexOf(CLOSE_THINK_TAG);
          if (closeIndex === -1) {
            buffer = buffer.slice(-CLOSE_THINK_TAG.length);
            return output;
          }

          buffer = buffer.slice(closeIndex + CLOSE_THINK_TAG.length);
          inThink = false;
          continue;
        }

        const openIndex = buffer.indexOf(OPEN_THINK_TAG);
        if (openIndex === -1) {
          const safeLength = Math.max(0, buffer.length - OPEN_THINK_TAG.length);
          if (safeLength === 0) {
            return output;
          }

          output += buffer.slice(0, safeLength);
          buffer = buffer.slice(safeLength);
          return output;
        }

        if (openIndex > 0) {
          output += buffer.slice(0, openIndex);
        }

        buffer = buffer.slice(openIndex + OPEN_THINK_TAG.length);
        inThink = true;
      }

      return output;
    },
    finish(): string {
      if (inThink) {
        buffer = '';
        inThink = false;
        return '';
      }

      const tail = stripThinkBlocks(buffer);
      buffer = '';
      return tail;
    },
  };
}

function normalizeStageText(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
}

function parseStageJson(text: string): StageJson | null {
  const normalized = normalizeStageText(text);
  const candidates = [normalized];
  const objectMatch = normalized.match(/\{[\s\S]*\}/);
  if (objectMatch && objectMatch[0] !== normalized) {
    candidates.push(objectMatch[0]);
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as StageJson;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

function formatMessages(messages: ModelMessage[]): string {
  return messages
    .slice(-6)
    .map((message) => {
      const content = typeof message.content === 'string'
        ? message.content
        : message.content
          .map((part) => part.type === 'text' ? part.text : `[${part.type}]`)
          .join('\n');
      return `[${message.role}]\n${content}`;
    })
    .join('\n\n');
}

function extractTextFromGenerateResult(result: LanguageModelV3GenerateResult): string {
  return result.content
    .filter((part): part is Extract<(typeof result.content)[number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

async function runTextStage(
  model: LanguageModel,
  stage: StageName,
  system: string,
  user: string,
  signal: AbortSignal | undefined,
  callbacks: Pick<StagedToolPipelineCallbacks, 'onStageStart' | 'onStageToken' | 'onStageComplete' | 'onStageError'>,
  meta?: { subStageId?: string; parentStageId?: string; label?: string },
): Promise<string> {
  const stageMeta = meta && (meta.subStageId || meta.parentStageId || meta.label) ? meta : undefined;
  callbacks.onStageStart?.(stage, user, stageMeta);
  const stageModel = model as unknown as StreamableModel;
  const sanitizer = createThinkBlockSanitizer();
  // Append `/no_think` as a belt-and-braces hint for Qwen3 templates that
  // interpret the trailing token regardless of `enable_thinking`.
  const stageUser = stage === 'chat' ? user : `${user}\n\n/no_think`;
  const prompt = [
    { role: 'system', content: system },
    { role: 'user', content: [{ type: 'text', text: stageUser }] },
  ];
  const stageCallOptions = {
    abortSignal: signal,
    prompt,
    tools: [],
    providerOptions: LOCAL_STAGE_PROVIDER_OPTIONS,
  };

  try {
    if (typeof stageModel.doStream === 'function') {
      const result = await stageModel.doStream(stageCallOptions);
      const reader = result.stream.getReader();
      let text = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value.type === 'text-delta') {
          const cleanedDelta = sanitizer.push(value.delta);
          if (cleanedDelta) {
            text += cleanedDelta;
            callbacks.onStageToken?.(stage, cleanedDelta, stageMeta);
          }
        }
        if (value.type === 'error') {
          throw value.error instanceof Error ? value.error : new Error(String(value.error));
        }
      }

      const tail = sanitizer.finish();
      if (tail) {
        text += tail;
        callbacks.onStageToken?.(stage, tail, stageMeta);
      }

      callbacks.onStageComplete?.(stage, text, stageMeta);
      return text;
    }

    if (typeof stageModel.doGenerate === 'function') {
      const result = await stageModel.doGenerate(stageCallOptions);
      const text = stripThinkBlocks(extractTextFromGenerateResult(result));
      if (text) {
        callbacks.onStageToken?.(stage, text, stageMeta);
      }
      callbacks.onStageComplete?.(stage, text, stageMeta);
      return text;
    }

    throw new Error('Model does not support staged planning calls.');
  } catch (error) {
    const wrapped = error instanceof Error ? error : new Error(String(error));
    callbacks.onStageError?.(stage, wrapped, stageMeta);
    throw wrapped;
  }
}

function pickMatchingGroups(groups: ToolGroupDescriptor[], parsed: StageJson, fallbackSource: string, maxGroups: number): ToolGroupDescriptor[] {
  const requested = new Set((parsed.groups ?? []).map((group) => group.trim()).filter(Boolean));
  const matched = groups.filter((group) => requested.has(group.id));
  if (matched.length > 0) {
    return matched.slice(0, maxGroups);
  }

  const lowered = fallbackSource.toLowerCase();
  const heuristic = groups.filter((group) => (
    lowered.includes(group.id.replace(/-worktree-mcp$/, '').replace(/-/g, ' '))
    || lowered.includes(group.label.toLowerCase())
    || lowered.includes(group.description.toLowerCase())
  ));
  return (heuristic.length > 0 ? heuristic : groups.slice(0, 1)).slice(0, maxGroups);
}

function pickMatchingTools(descriptors: ToolDescriptor[], parsed: StageJson, fallbackSource: string, maxTools: number): ToolDescriptor[] {
  const requested = new Set((parsed.toolIds ?? []).map((toolId) => toolId.trim()).filter(Boolean));
  const matched = descriptors.filter((descriptor) => requested.has(descriptor.id));
  if (matched.length > 0) {
    return matched.slice(0, maxTools);
  }

  const lowered = fallbackSource.toLowerCase();
  const heuristic = descriptors.filter((descriptor) => (
    lowered.includes(descriptor.id.toLowerCase())
    || lowered.includes(descriptor.label.toLowerCase())
    || lowered.includes(descriptor.description.toLowerCase())
  ));
  return (heuristic.length > 0 ? heuristic : descriptors.slice(0, 1)).slice(0, maxTools);
}

function buildStageMessages(instructions: string, transcript: string, maxInputTokens: number): BudgetedMessage[] {
  return [
    { role: 'system', content: fitTextToTokenBudget(instructions, Math.max(64, Math.floor(maxInputTokens * 0.4))) },
    { role: 'user', content: fitTextToTokenBudget(transcript, Math.max(64, Math.floor(maxInputTokens * 0.6))) },
  ];
}

async function runExecutorWithStage(
  callbacks: StagedToolPipelineCallbacks,
  executor: () => Promise<AgentRunResult>,
): Promise<AgentRunResult> {
  callbacks.onStageStart?.('executor', 'Executing selected tools and composing the response.');
  try {
    const result = await executor();
    callbacks.onStageComplete?.('executor', result.text);
    return result;
  } catch (error) {
    const executorError = error instanceof Error ? error : new Error(String(error));
    callbacks.onStageError?.('executor', executorError);
    throw executorError;
  }
}

export async function runStagedToolPipeline(
  options: StagedToolPipelineOptions,
  callbacks: StagedToolPipelineCallbacks,
): Promise<AgentRunResult> {
  const {
    model,
    tools,
    toolDescriptors,
    instructions,
    messages,
    workspaceName,
    capabilities,
    signal,
    maxSteps = 20,
    maxGroups = 2,
    maxTools = 4,
  } = options;
  const transcript = formatMessages(messages);

  const routerBudget = createPromptBudget({
    contextWindow: capabilities.contextWindow,
    maxOutputTokens: ROUTER_OUTPUT_TOKENS,
  });
  const routerMessages = buildStageMessages(instructions, transcript, routerBudget.maxInputTokens);
  const routerText = await runTextStage(
    model,
    'router',
    buildToolRouterPrompt({ workspaceName, instructions: routerMessages[0]?.content ?? '' }),
    routerMessages[1]?.content ?? transcript,
    signal,
    callbacks,
  );
  const routerSelection = parseStageJson(routerText);

  // Only fall back to direct chat when there are no tools available at all.
  // We deliberately ignore a router "mode: chat" verdict whenever tools exist
  // so the run always exercises tool selection + the LogAct executor, even
  // when the local router model is tiny or hesitant. Getting work done with
  // tools is more important than letting the router short-circuit to a
  // naive textual answer.
  const routerWantsChatMode = !toolDescriptors.length;

  if (routerWantsChatMode) {
    const chatScenario = resolveAgentScenario(transcript);
    const chatText = await runTextStage(
      model,
      'chat',
      [
        buildAgentSystemPrompt({
          workspaceName,
          goal: routerSelection?.goal ?? 'Answer the request directly without tools.',
          scenario: chatScenario,
        }),
        '## Workspace Context',
        fitTextToTokenBudget(instructions, routerBudget.maxInputTokens),
      ].join('\n\n'),
      fitTextToTokenBudget(transcript, routerBudget.maxInputTokens),
      signal,
      callbacks,
    );
    callbacks.onToken?.(chatText);
    callbacks.onDone?.(chatText);
    return { text: chatText, steps: 2 };
  }

  const availableGroups = buildToolGroupDescriptors(toolDescriptors);
  const groupBudget = createPromptBudget({
    contextWindow: capabilities.contextWindow,
    maxOutputTokens: GROUP_SELECTOR_OUTPUT_TOKENS,
  });
  const groupSelectorText = await runTextStage(
    model,
    'group-select',
    buildToolGroupSelectionPrompt({ groups: availableGroups, workspaceName }),
    fitTextToTokenBudget(`${routerSelection?.goal ?? transcript}\n\n${transcript}`, groupBudget.maxInputTokens),
    signal,
    callbacks,
  );
  const selectedGroups = pickMatchingGroups(availableGroups, parseStageJson(groupSelectorText) ?? {}, groupSelectorText, maxGroups);

  const toolBudget = createPromptBudget({
    contextWindow: capabilities.contextWindow,
    maxOutputTokens: TOOL_SELECTOR_OUTPUT_TOKENS,
  });
  const toolSelectorUser = fitTextToTokenBudget(`${routerSelection?.goal ?? transcript}\n\n${transcript}`, toolBudget.maxInputTokens);

  // Open a parent `tool-select` aggregate node so the watchdog can attach to
  // the parent while the per-group children stream in parallel. Tokens are
  // not forwarded to the parent — they belong to the children.
  callbacks.onStageStart?.('tool-select', toolSelectorUser);

  // Fan out one tool-select call per group in parallel. A single failing
  // group does not abort planning; the executor proceeds with whatever tools
  // the surviving groups returned. Emits per-group sub-stage callbacks
  // tagged with `subStageId` so the App-level ProcessLog renders each as a
  // child row under the parent `tool-select` node.
  const perGroupResults = await Promise.allSettled(
    selectedGroups.map(async (group) => {
      const groupDescriptors = toolDescriptors.filter((descriptor) => group.toolIds.includes(descriptor.id));
      const text = await runTextStage(
        model,
        'tool-select',
        buildToolSelectorPrompt({ descriptors: groupDescriptors, workspaceName }),
        toolSelectorUser,
        signal,
        callbacks,
        { subStageId: group.id, parentStageId: 'tool-select', label: group.label },
      );
      const picked = pickMatchingTools(groupDescriptors, parseStageJson(text) ?? {}, text, maxTools);
      return { group, text, picked };
    }),
  );

  const stalledGroupIds: string[] = [];
  const succeededTexts: string[] = [];
  const mergedDescriptors: ToolDescriptor[] = [];
  const seenToolIds = new Set<string>();
  for (let i = 0; i < perGroupResults.length; i += 1) {
    const result = perGroupResults[i];
    const group = selectedGroups[i];
    if (result.status === 'fulfilled') {
      succeededTexts.push(result.value.text);
      for (const descriptor of result.value.picked) {
        if (!seenToolIds.has(descriptor.id)) {
          seenToolIds.add(descriptor.id);
          mergedDescriptors.push(descriptor);
        }
      }
    } else {
      stalledGroupIds.push(group.id);
    }
  }

  // Re-cap to maxTools across all groups so the executor's catalog stays
  // bounded even when many groups succeeded in parallel.
  const selectedDescriptors = mergedDescriptors.slice(0, maxTools);

  // Close the parent aggregate node. Surface stalled group ids in the parent
  // transcript so the user can see which groups did not complete.
  const parentSummary = stalledGroupIds.length > 0 && succeededTexts.length > 0
    ? `Continued with ${succeededTexts.length} group${succeededTexts.length === 1 ? '' : 's'}; stalled: ${stalledGroupIds.join(', ')}`
    : succeededTexts.join('\n\n');
  callbacks.onStageComplete?.('tool-select', parentSummary);

  if (selectedDescriptors.length === 0 && stalledGroupIds.length === selectedGroups.length) {
    // All groups failed; rethrow the first rejection so the caller can react.
    const firstFailure = perGroupResults.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined;
    if (firstFailure) {
      throw firstFailure.reason instanceof Error ? firstFailure.reason : new Error(String(firstFailure.reason));
    }
  }

  const selectedToolIds = selectedDescriptors.map((descriptor) => descriptor.id);
  const filteredTools = selectToolsByIds(tools, selectedToolIds);
  const focusedInstructions = [
    buildToolInstructionsTemplate({
      workspaceName: workspaceName ?? 'Workspace',
      workspacePromptContext: fitTextToTokenBudget(instructions, Math.max(128, Math.floor(capabilities.contextWindow * 0.35))),
      descriptors: selectedDescriptors,
      selectedToolIds,
      selectedGroups: selectedGroups.map((group) => group.id),
    }),
    `Selected tool groups: ${selectedGroups.map((group) => group.label).join(', ') || 'none'}`,
    `Selected tools: ${selectedDescriptors.map((descriptor) => descriptor.label).join(', ') || 'none'}`,
    'Prefer the selected tools. Only answer directly if no tool is necessary after planning.',
  ].join('\n\n');

  // Cap executor steps tighter for local models: a Qwen3-0.6B thinking backbone
  // at ~3-5 s per generation easily chews through a 20-step loop before the
  // user's idle timer ever fires. 6 steps is enough for one tool + one answer
  // plus a retry, and speeds up failure surfacing.
  const isLocalModel = (model as { provider?: string }).provider === 'local';
  const effectiveMaxSteps = isLocalModel
    ? Math.min(maxSteps, LOCAL_EXECUTOR_MAX_STEPS)
    : maxSteps;

  const voters = [...(options.voters ?? [])];
  const defaultTask = typeof messages.at(-1)?.content === 'string'
    ? messages.at(-1)?.content
    : messages.at(-1)?.content
      .map((part) => (part.type === 'text' ? part.text : ''))
      .join('\n');
  let completionChecker = options.completionChecker
    ?? (isExecutionTask(defaultTask) ? createHeuristicCompletionChecker(defaultTask) : undefined);

  // For local models with tools available, ALWAYS attach mandatory tool-use
  // voters and a must-execute completion checker. This satisfies the contract
  // that local runs MUST follow LogAct AND MUST use tool-calling — without
  // these, the local backbone tends to short-circuit into a naive plan-only
  // text answer and never invokes any tool.
  if (isLocalModel && selectedDescriptors.length > 0) {
    const hasMustUse = voters.some((voter) => voter.id === 'must-use-tool');
    const hasNoPlanOnly = voters.some((voter) => voter.id === 'no-plan-only');
    if (!hasMustUse) voters.push(createMustUseToolVoter());
    if (!hasNoPlanOnly) voters.push(createNoPlanOnlyVoter());
    if (!completionChecker) completionChecker = createMustExecuteCompletionChecker();
  }

  const maxIterations = options.maxIterations ?? 5;

  if (voters.length === 0 && !completionChecker) {
    if (isLocalModel) {
      return runExecutorWithStage(callbacks, () => runLocalToolCallExecutor({
        model,
        tools: filteredTools,
        toolDescriptors: selectedDescriptors,
        instructions: focusedInstructions,
        messages,
        signal,
        maxSteps: effectiveMaxSteps,
      }, callbacks));
    }
    return runExecutorWithStage(callbacks, () => runToolAgent({
      model,
      tools: filteredTools,
      instructions: focusedInstructions,
      messages,
      maxSteps: effectiveMaxSteps,
      signal,
    }, callbacks));
  }

  if (isLocalModel) {
    // Local models cannot emit AI-SDK tool calls. Route the entire LogAct
    // executor pass through the JSON tool-call ReAct loop so voters and the
    // completion checker still apply, but the inner inference uses
    // `runLocalToolCallExecutor` instead of `runToolAgent`.
    return runExecutorWithStage(callbacks, () => runLocalToolCallExecutor({
      model,
      tools: filteredTools,
      toolDescriptors: selectedDescriptors,
      instructions: focusedInstructions,
      messages,
      signal,
      maxSteps: effectiveMaxSteps,
      voters,
      completionChecker,
      maxIterations,
    }, callbacks));
  }

  // Voters present: route the executor phase through LogAct so tool intents
  // flow through Driver → Voter(s) → Decider → Executor, exactly like the
  // plain chat path. If a completion checker is present, keep iterating in a
  // Ralph-style loop until the checker marks the task done. Tool callbacks
  // still fire out-of-band for the UI.
  let captured: AgentRunResult = { text: '', steps: 0 };
  let failure: Error | null = null;
  let feedbackMessages: ModelMessage[] = [];
  const executorCallbacks = completionChecker
    ? {
      ...callbacks,
      onToken: undefined,
      onDone: undefined,
    }
    : callbacks;

  // Observed bus so the non-local LogAct path also surfaces Mail/Intent/
  // Vote/Result/etc. rows in the ProcessLog (matches the local executor).
  const observedBus = createObservedBus(callbacks.onBusEntry);

  await runAgentLoop({
    bus: observedBus,
    inferenceClient: {
      async infer() {
        try {
          const executorMessages = feedbackMessages.length > 0
            ? [...messages, ...feedbackMessages]
            : messages;
          captured = await runToolAgent({
            model,
            tools: filteredTools,
            instructions: focusedInstructions,
            messages: executorMessages,
            maxSteps: effectiveMaxSteps,
            signal,
          }, executorCallbacks);
          return captured.text;
        } catch (error) {
          failure = error instanceof Error ? error : new Error(String(error));
          throw failure;
        }
      },
    },
    messages: messages.map((message) => ({
      content: typeof message.content === 'string'
        ? message.content
        : message.content
          .map((part) => (part.type === 'text' ? part.text : `[${part.type}]`))
          .join('\n'),
    })),
    voters,
    completionChecker: completionChecker
      ? {
        async check(context) {
          const result = await completionChecker.check(context);
          if (!result.done && result.feedback?.trim()) {
            feedbackMessages = [
              { role: 'assistant', content: [{ type: 'text', text: captured.text }] },
              { role: 'system', content: result.feedback.trim() },
            ];
          } else {
            feedbackMessages = [];
          }
          return result;
        },
      }
      : undefined,
    maxIterations: completionChecker ? maxIterations : 1,
  }, callbacks);

  if (failure) {
    throw failure;
  }

  if (completionChecker) {
    callbacks.onToken?.(captured.text);
    callbacks.onDone?.(captured.text);
  }

  return captured;
}

export function selectStageDescriptors(
  toolDescriptors: ToolDescriptor[],
  toolIds: string[],
): ToolDescriptor[] {
  return selectToolDescriptorsByIds(toolDescriptors, toolIds);
}