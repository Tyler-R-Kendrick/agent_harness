import type { LanguageModel, ToolSet } from 'ai';
import type { ModelMessage } from '@ai-sdk/provider-utils';
import type { LanguageModelV3GenerateResult, LanguageModelV3StreamPart } from '@ai-sdk/provider';
import { runToolAgent, type AgentRunCallbacks, type AgentRunResult } from './agentRunner';
import { buildAgentSystemPrompt, buildToolInstructionsTemplate, buildToolGroupSelectionPrompt, buildToolRouterPrompt, buildToolSelectorPrompt, resolveAgentScenario } from './agentPromptTemplates';
import { createPromptBudget, fitTextToTokenBudget, type BudgetedMessage } from './promptBudget';
import type { ModelCapabilities } from './agentProvider';
import {
  buildToolGroupDescriptors,
  selectToolDescriptorsByIds,
  selectToolsByIds,
  type ToolDescriptor,
  type ToolGroupDescriptor,
} from '../tools';

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

type StageName = 'router' | 'group-select' | 'tool-select' | 'chat';

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
};

export type StagedToolPipelineCallbacks = AgentRunCallbacks & {
  onStageStart?: (stage: StageName, detail: string) => void;
  onStageToken?: (stage: StageName, delta: string) => void;
  onStageComplete?: (stage: StageName, text: string) => void;
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
  callbacks: Pick<StagedToolPipelineCallbacks, 'onStageStart' | 'onStageToken' | 'onStageComplete'>,
): Promise<string> {
  callbacks.onStageStart?.(stage, user);
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
          callbacks.onStageToken?.(stage, cleanedDelta);
        }
      }
      if (value.type === 'error') {
        throw value.error instanceof Error ? value.error : new Error(String(value.error));
      }
    }

    const tail = sanitizer.finish();
    if (tail) {
      text += tail;
      callbacks.onStageToken?.(stage, tail);
    }

    callbacks.onStageComplete?.(stage, text);
    return text;
  }

  if (typeof stageModel.doGenerate === 'function') {
    const result = await stageModel.doGenerate(stageCallOptions);
    const text = stripThinkBlocks(extractTextFromGenerateResult(result));
    if (text) {
      callbacks.onStageToken?.(stage, text);
    }
    callbacks.onStageComplete?.(stage, text);
    return text;
  }

  throw new Error('Model does not support staged planning calls.');
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

  if (routerSelection?.mode === 'chat' || !toolDescriptors.length) {
    const chatScenario = resolveAgentScenario(`${instructions}\n${transcript}`);
    const chatText = await runTextStage(
      model,
      'chat',
      [
        buildAgentSystemPrompt({
          workspaceName,
          goal: routerSelection?.goal ?? 'Answer the request directly without tools.',
          scenario: chatScenario,
        }),
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

  const selectedGroupToolIds = new Set(selectedGroups.flatMap((group) => group.toolIds));
  const descriptorsForGroups = toolDescriptors.filter((descriptor) => selectedGroupToolIds.has(descriptor.id));
  const toolBudget = createPromptBudget({
    contextWindow: capabilities.contextWindow,
    maxOutputTokens: TOOL_SELECTOR_OUTPUT_TOKENS,
  });
  const toolSelectorText = await runTextStage(
    model,
    'tool-select',
    buildToolSelectorPrompt({ descriptors: descriptorsForGroups, workspaceName }),
    fitTextToTokenBudget(`${routerSelection?.goal ?? transcript}\n\n${transcript}`, toolBudget.maxInputTokens),
    signal,
    callbacks,
  );
  const selectedDescriptors = pickMatchingTools(descriptorsForGroups, parseStageJson(toolSelectorText) ?? {}, toolSelectorText, maxTools);
  const selectedToolIds = selectedDescriptors.map((descriptor) => descriptor.id);
  const filteredTools = selectToolsByIds(tools, selectedToolIds);
  const focusedInstructions = [
    buildToolInstructionsTemplate({
      workspaceName: workspaceName ?? 'Workspace',
      workspacePromptContext: fitTextToTokenBudget(instructions, Math.max(128, Math.floor(capabilities.contextWindow * 0.35))),
      descriptors: selectedDescriptors,
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

  return runToolAgent({
    model,
    tools: filteredTools,
    instructions: focusedInstructions,
    messages,
    maxSteps: effectiveMaxSteps,
    signal,
  }, callbacks);
}

export function selectStageDescriptors(
  toolDescriptors: ToolDescriptor[],
  toolIds: string[],
): ToolDescriptor[] {
  return selectToolDescriptorsByIds(toolDescriptors, toolIds);
}