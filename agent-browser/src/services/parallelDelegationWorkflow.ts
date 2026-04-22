import type { LanguageModel } from 'ai';
import type { LanguageModelV3GenerateResult, LanguageModelV3StreamPart } from '@ai-sdk/provider';
import { runAgentLoop } from '../chat-agents/agent-loop';
import { buildDelegationWorkerPrompt, buildDelegationWorkerTask } from './agentPromptTemplates';
import { fitTextToTokenBudget } from './promptBudget';
import type { ModelCapabilities } from './agentProvider';
import { createHeuristicCompletionChecker } from 'ralph-loop';

type StreamableModel = {
  doGenerate?: (options: unknown) => Promise<LanguageModelV3GenerateResult>;
  doStream?: (options: unknown) => Promise<{ stream: ReadableStream<LanguageModelV3StreamPart> }>;
};

export type ParallelDelegationStepId = 'coordinator' | 'breakdown-agent' | 'assignment-agent' | 'validation-agent';

export type ParallelDelegationCallbacks = {
  onStepStart?: (stepId: ParallelDelegationStepId, title: string, body: string) => void;
  onStepToken?: (stepId: ParallelDelegationStepId, delta: string) => void;
  onStepComplete?: (stepId: ParallelDelegationStepId, text: string) => void;
  onDone?: (text: string) => void;
  onError?: (error: Error) => void;
};

export type ParallelDelegationWorkflowOptions = {
  model: LanguageModel;
  prompt: string;
  workspaceName: string;
  capabilities: Pick<ModelCapabilities, 'provider' | 'contextWindow' | 'maxOutputTokens'>;
  signal?: AbortSignal;
};

const OPEN_THINK_TAG = '<think>';
const CLOSE_THINK_TAG = '</think>';

type SectionKey = 'problem' | 'breakdown' | 'assignment' | 'validation';

export const DELEGATION_SECTION_MARKERS: Record<SectionKey, string> = {
  problem: '===PROBLEM===',
  breakdown: '===BREAKDOWN===',
  assignment: '===ASSIGNMENT===',
  validation: '===VALIDATION===',
};

const SECTION_TO_STEP: Record<Exclude<SectionKey, 'problem'>, Exclude<ParallelDelegationStepId, 'coordinator'>> = {
  breakdown: 'breakdown-agent',
  assignment: 'assignment-agent',
  validation: 'validation-agent',
};

export type SectionRouter = {
  push: (delta: string) => void;
  finish: () => Record<SectionKey, string>;
};

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

function estimatePromptBudget(capabilities: Pick<ModelCapabilities, 'contextWindow'>): number {
  return Math.max(96, Math.floor(capabilities.contextWindow * 0.45));
}

function extractTextFromGenerateResult(result: LanguageModelV3GenerateResult): string {
  return result.content
    .filter((part): part is Extract<(typeof result.content)[number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

async function runCompactTextTask(
  model: LanguageModel,
  system: string,
  user: string,
  signal: AbortSignal | undefined,
  generationOptions: { maxOutputTokens?: number; temperature?: number; topP?: number } = {},
  onToken?: (delta: string) => void,
): Promise<string> {
  const typedModel = model as unknown as StreamableModel;
  const sanitizer = createThinkBlockSanitizer();
  const prompt = [
    { role: 'system', content: system },
    { role: 'user', content: [{ type: 'text', text: user }] },
  ];

  if (typeof typedModel.doStream === 'function') {
    const result = await typedModel.doStream({
      abortSignal: signal,
      prompt,
      tools: [],
      ...generationOptions,
    });
    const reader = result.stream.getReader();
    let text = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value.type === 'text-delta') {
        const cleanedDelta = sanitizer.push(value.delta);
        if (cleanedDelta) {
          text += cleanedDelta;
          onToken?.(cleanedDelta);
        }
      }
      if (value.type === 'error') {
        throw value.error instanceof Error ? value.error : new Error(String(value.error));
      }
    }

    const tail = sanitizer.finish();
    if (tail) {
      text += tail;
      onToken?.(tail);
    }

    return text.trim();
  }

  if (typeof typedModel.doGenerate === 'function') {
    const result = await typedModel.doGenerate({
      abortSignal: signal,
      prompt,
      tools: [],
      ...generationOptions,
    });
    const text = stripThinkBlocks(extractTextFromGenerateResult(result)).trim();
    if (text) {
      onToken?.(text);
    }
    return text;
  }

  throw new Error('Model does not support compact delegation tasks.');
}

async function runCompactAgentTask(
  model: LanguageModel,
  system: string,
  user: string,
  signal: AbortSignal | undefined,
  generationOptions: { maxOutputTokens?: number; temperature?: number; topP?: number } = {},
  onToken?: (delta: string) => void,
): Promise<string> {
  let resolvedText = '';
  let failure: Error | null = null;
  let bufferedText = '';
  const completionChecker = createHeuristicCompletionChecker(user);

  await runAgentLoop({
    inferenceClient: {
      async infer() {
        try {
          bufferedText = '';
          resolvedText = await runCompactTextTask(model, system, user, signal, generationOptions, (delta) => {
            bufferedText += delta;
          });
          return resolvedText;
        } catch (error) {
          failure = error instanceof Error ? error : new Error(String(error));
          throw failure;
        }
      },
    },
    messages: [{ content: user }],
    input: user,
    completionChecker: {
      async check(context) {
        const result = await completionChecker.check(context);
        if (result.done && bufferedText) {
          onToken?.(bufferedText);
        }
        bufferedText = '';
        return result;
      },
    },
    maxIterations: 5,
  }, {});

  if (failure) {
    throw failure;
  }

  return resolvedText.trim();
}

export function isParallelDelegationPrompt(prompt: string): boolean {
  const lowered = prompt.toLowerCase();
  const hasParallelCue = /(parallel|paralleliz|concurrent)/.test(lowered);
  const hasDelegationCue = /(delegate|delegation|subagents?|sub-agents?|specialist agents?|worker agents?)/.test(lowered);
  const hasDecompositionCue = /(multi-step|multiple steps|break .* into|split .* work|decompose|independent tasks?)/.test(lowered);

  return (hasParallelCue && hasDelegationCue) || (hasDelegationCue && hasDecompositionCue);
}

export function buildDelegationProblemBrief(prompt: string, workspaceName: string): string {
  const compactPrompt = prompt.replace(/\s+/g, ' ').trim();
  return [
    `Active workspace: ${workspaceName}`,
    'Coordinator brief: choose one concrete multi-step problem that can be parallelized and delegated across specialist subagents.',
    `User request: ${compactPrompt}`,
    'Keep the work focused, compact, and executable without broad workspace scans.',
  ].join('\n');
}

function synthesizeDelegationReport(problemBrief: string, outputs: Record<Exclude<ParallelDelegationStepId, 'coordinator'>, string>): string {
  return [
    'Parallel delegation plan',
    '',
    problemBrief,
    '',
    'Subagent breakdown',
    outputs['breakdown-agent'],
    '',
    'Subagent assignments',
    outputs['assignment-agent'],
    '',
    'Validation and risk checks',
    outputs['validation-agent'],
  ].join('\n');
}

function extractJsonObject(text: string): string | null {
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  const directObject = normalized.match(/\{[\s\S]*\}/);
  return directObject?.[0] ?? null;
}

function parseDelegationProblem(text: string, fallbackPrompt: string): string {
  const cleaned = stripThinkBlocks(text);
  const jsonObject = extractJsonObject(cleaned);

  if (jsonObject) {
    try {
      const parsed = JSON.parse(jsonObject) as { problem?: unknown };
      if (typeof parsed.problem === 'string' && parsed.problem.trim()) {
        return parsed.problem.trim();
      }
    } catch {
      // Fall through to text heuristics.
    }
  }

  const firstMeaningfulLine = cleaned
    .split('\n')
    .map((line) => line.trim())
    .map((line) => line.replace(/^[-*]\s*/, '').replace(/^problem:\s*/i, '').trim())
    .find(Boolean);

  return firstMeaningfulLine ?? fallbackPrompt;
}

export function buildSectionedDelegationPrompt(workspaceName: string): string {
  return [
    buildDelegationWorkerPrompt({ workspaceName, worker: 'coordinator' }),
    'delegation-worker:sectioned-plan',
    'You will act as the coordinator and emit distinct hand-offs for three specialist subagents in a single pass.',
    'Emit exactly these four sections, in this order, each marker on its own line, with no surrounding prose:',
    DELEGATION_SECTION_MARKERS.problem,
    '<one concrete sentence stating the delegated problem>',
    DELEGATION_SECTION_MARKERS.breakdown,
    '<2-3 bullet points; each bullet is a distinct parallel work track with no overlap>',
    DELEGATION_SECTION_MARKERS.assignment,
    '<2-3 bullet points mapping each track to a specialist role and explicit handoff, in the form "Role: task and handoff to next role">',
    DELEGATION_SECTION_MARKERS.validation,
    '<2-3 bullet points listing concrete risks and validation checks that are not restatements of the breakdown or assignment>',
    'Rules:',
    '- Each section must contain content specific to its purpose.',
    '- Do not repeat the same bullets across sections.',
    '- Validation describes how to verify success, not what the work is.',
    '- No preamble, no markdown fences, and no think tags.',
  ].join('\n');
}

function buildSectionedDelegationTask({
  userPrompt,
  coordinatorProblem,
}: {
  userPrompt: string;
  coordinatorProblem: string;
}): string {
  return [
    `Original user request: ${userPrompt}`,
    `Chosen delegation problem: ${coordinatorProblem}`,
    'Use the chosen delegation problem exactly as given.',
    'Emit the required sections now.',
  ].join('\n\n');
}

export function createDelegationSectionRouter(onSectionDelta: (section: SectionKey, delta: string) => void): SectionRouter {
  const buffers: Record<SectionKey, string> = {
    problem: '',
    breakdown: '',
    assignment: '',
    validation: '',
  };
  const markerEntries = Object.entries(DELEGATION_SECTION_MARKERS) as Array<[SectionKey, string]>;
  const longestMarker = Math.max(...markerEntries.map(([, marker]) => marker.length));
  let currentSection: SectionKey | null = null;
  let pending = '';

  const flushCurrent = (text: string) => {
    if (!text || !currentSection) return;
    buffers[currentSection] += text;
    onSectionDelta(currentSection, text);
  };

  return {
    push(delta: string) {
      if (!delta) return;
      pending += delta;

      while (pending.length > 0) {
        let markerIndex = -1;
        let markerSection: SectionKey | null = null;
        let markerLength = 0;

        for (const [section, marker] of markerEntries) {
          const index = pending.indexOf(marker);
          if (index !== -1 && (markerIndex === -1 || index < markerIndex)) {
            markerIndex = index;
            markerSection = section;
            markerLength = marker.length;
          }
        }

        if (markerIndex === -1) {
          const holdback = Math.min(pending.length, longestMarker);
          const safeLength = currentSection ? pending.length - holdback : 0;
          if (safeLength > 0) {
            flushCurrent(pending.slice(0, safeLength));
            pending = pending.slice(safeLength);
          }
          return;
        }

        if (markerIndex > 0) {
          flushCurrent(pending.slice(0, markerIndex));
        }

        let cursor = markerIndex + markerLength;
        while (cursor < pending.length && /[\r\n\t ]/.test(pending[cursor] ?? '')) {
          cursor += 1;
        }
        pending = pending.slice(cursor);
        currentSection = markerSection;
      }
    },
    finish() {
      if (pending) {
        flushCurrent(pending);
        pending = '';
      }
      return buffers;
    },
  };
}

async function runSectionedLocalDelegation(
  options: ParallelDelegationWorkflowOptions,
  callbacks: ParallelDelegationCallbacks,
  problemBrief: string,
  compactBudget: number,
): Promise<{ text: string; steps: number }> {
  const { model, signal, workspaceName } = options;

  callbacks.onStepStart?.('coordinator', 'Coordinator brief', problemBrief);
  callbacks.onStepStart?.('breakdown-agent', 'Breakdown subagent', 'Breaking the problem into the smallest parallel tracks.');
  callbacks.onStepStart?.('assignment-agent', 'Assignment subagent', 'Assigning each track to a focused subagent role.');
  callbacks.onStepStart?.('validation-agent', 'Validation subagent', 'Defining success checks and coordination risks.');

  const router = createDelegationSectionRouter((section, delta) => {
    if (section === 'problem') {
      callbacks.onStepToken?.('coordinator', delta);
      return;
    }

    callbacks.onStepToken?.(SECTION_TO_STEP[section], delta);
  });

  await runCompactAgentTask(
    model,
    fitTextToTokenBudget(buildSectionedDelegationPrompt(workspaceName), Math.max(96, Math.floor(compactBudget * 0.5))),
    problemBrief,
    signal,
    { maxOutputTokens: 96, temperature: 0.1, topP: 1 },
    (delta) => router.push(delta),
  );

  const sections = router.finish();
  const problemText = sections.problem.trim() || problemBrief;
  const breakdownText = sections.breakdown.trim() || '(breakdown subagent did not emit distinct tracks)';
  const assignmentText = sections.assignment.trim() || '(assignment subagent did not emit role handoffs)';
  const validationText = sections.validation.trim() || '(validation subagent did not emit risks or checks)';

  callbacks.onStepComplete?.('coordinator', problemText);
  callbacks.onStepComplete?.('breakdown-agent', breakdownText);
  callbacks.onStepComplete?.('assignment-agent', assignmentText);
  callbacks.onStepComplete?.('validation-agent', validationText);

  const text = synthesizeDelegationReport(problemBrief, {
    'breakdown-agent': breakdownText,
    'assignment-agent': assignmentText,
    'validation-agent': validationText,
  });
  callbacks.onDone?.(text);
  return { text, steps: 4 };
}

async function runSectionedRemoteDelegation(
  options: ParallelDelegationWorkflowOptions,
  callbacks: ParallelDelegationCallbacks,
  coordinatorProblem: string,
  compactBudget: number,
): Promise<{ text: string; steps: number }> {
  const { model, signal, workspaceName, prompt } = options;

  callbacks.onStepStart?.('breakdown-agent', 'Breakdown subagent', 'Breaking the problem into the smallest parallel tracks.');
  callbacks.onStepStart?.('assignment-agent', 'Assignment subagent', 'Assigning each track to a focused subagent role.');
  callbacks.onStepStart?.('validation-agent', 'Validation subagent', 'Defining success checks and coordination risks.');

  const router = createDelegationSectionRouter((section, delta) => {
    if (section === 'problem') {
      return;
    }

    callbacks.onStepToken?.(SECTION_TO_STEP[section], delta);
  });

  await runCompactAgentTask(
    model,
    fitTextToTokenBudget(buildSectionedDelegationPrompt(workspaceName), Math.max(96, Math.floor(compactBudget * 0.5))),
    buildSectionedDelegationTask({ userPrompt: prompt, coordinatorProblem }),
    signal,
    { maxOutputTokens: 96, temperature: 0.1, topP: 1 },
    (delta) => router.push(delta),
  );

  const sections = router.finish();
  const breakdownText = sections.breakdown.trim() || '(breakdown subagent did not emit distinct tracks)';
  const assignmentText = sections.assignment.trim() || '(assignment subagent did not emit role handoffs)';
  const validationText = sections.validation.trim() || '(validation subagent did not emit risks or checks)';

  callbacks.onStepComplete?.('breakdown-agent', breakdownText);
  callbacks.onStepComplete?.('assignment-agent', assignmentText);
  callbacks.onStepComplete?.('validation-agent', validationText);

  const text = synthesizeDelegationReport(buildDelegationProblemBrief(prompt, workspaceName), {
    'breakdown-agent': breakdownText,
    'assignment-agent': assignmentText,
    'validation-agent': validationText,
  });
  callbacks.onDone?.(text);
  return { text, steps: 4 };
}

export async function runParallelDelegationWorkflow(
  options: ParallelDelegationWorkflowOptions,
  callbacks: ParallelDelegationCallbacks = {},
): Promise<{ text: string; steps: number }> {
  const { model, prompt, workspaceName, capabilities, signal } = options;
  const compactBudget = estimatePromptBudget(capabilities);
  const problemBrief = fitTextToTokenBudget(buildDelegationProblemBrief(prompt, workspaceName), compactBudget);

  if (capabilities.provider === 'local' || (model as { provider?: string }).provider === 'local') {
    return runSectionedLocalDelegation(options, callbacks, problemBrief, compactBudget);
  }

  callbacks.onStepStart?.('coordinator', 'Coordinator brief', problemBrief);
  const coordinatorText = await runCompactAgentTask(
    model,
    fitTextToTokenBudget([
      buildDelegationWorkerPrompt({ workspaceName, worker: 'coordinator' }),
      'Return only the one-sentence delegated problem the subagents should solve.',
      'Do not include bullets, markdown fences, or extra explanation.',
    ].join('\n\n'), Math.max(48, Math.floor(compactBudget * 0.3))),
    problemBrief,
    signal,
    { maxOutputTokens: 64, temperature: 0.1, topP: 1 },
    (delta) => callbacks.onStepToken?.('coordinator', delta),
  );
  const coordinatorProblem = parseDelegationProblem(coordinatorText, problemBrief);
  callbacks.onStepComplete?.('coordinator', coordinatorProblem);

  return runSectionedRemoteDelegation(options, callbacks, coordinatorProblem, compactBudget);
}
