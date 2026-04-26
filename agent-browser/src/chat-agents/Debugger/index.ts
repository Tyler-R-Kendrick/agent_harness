import type { IVoter } from 'logact';
import type { ChatMessage, HFModel } from '../../types';
import type { ToolDescriptor } from '../../tools';
import { buildAgentSystemPrompt, buildToolInstructionsTemplate } from '../../services/agentPromptTemplates';
import { streamCodiChat } from '../Codi';
import { streamGhcpChat } from '../Ghcp';
import type { AgentStreamCallbacks, ModelBackedAgentProvider } from '../types';

export const DEBUGGER_LABEL = 'Debugger';

export function isDebuggingTaskText(text: string): boolean {
  return /\b(debug|debugging|troubleshoot|troubleshooting|diagnose|diagnostic|root cause|root-cause|rca|incident|postmortem|outage|regression|failure|failing|broken|why (is|are|did|does|do)|error|exception)\b/i.test(text);
}

export function buildDebuggerOperatingInstructions(): string {
  return [
    '# Debugger',
    '',
    '## Purpose',
    '- Help users triage issues and perform root-cause analysis across code, product behavior, systems, operations, data, and workflows.',
    '',
    '## Goals',
    '- Define the symptom, expected behavior, impact, affected scope, urgency, and known timeline before proposing a fix.',
    '- Build a hypothesis ledger with evidence for, evidence against, confidence, and the next validation step.',
    '- Separate mitigation from root-cause proof so the user can recover quickly without losing diagnostic rigor.',
    '- Prefer the smallest useful experiment, log check, reproduction, rollback, or tool call that can eliminate or confirm a hypothesis.',
    '- Finish with verified cause, mitigation or fix, verification evidence, unresolved risks, and prevention follow-ups.',
    '',
    '## Constraints',
    '- Do not collapse correlation into causation.',
    '- Do not present a suspected cause as confirmed until evidence distinguishes it from plausible alternatives.',
    '- Do not over-focus on code when the symptom could come from configuration, data, dependencies, operations, user workflow, or environment.',
    '- Keep uncertainty explicit and ask for the single missing fact that most improves the diagnosis when blocked.',
    '',
    '## Workflow',
    '1. Restate the issue as symptom, expected behavior, observed behavior, impact, scope, and first-known-bad time.',
    '2. Capture recent changes, dependencies, environment differences, and any available logs, metrics, traces, screenshots, repro steps, or user reports.',
    '3. Create a hypothesis ledger and rank hypotheses by explanatory power, blast radius, reversibility, and evidence quality.',
    '4. Choose the next diagnostic action that can eliminate the most uncertainty with the least risk.',
    '5. Recommend mitigation separately from durable repair when user impact is ongoing.',
    '6. Verify the fix or mitigation against the original symptom and list follow-up prevention work.',
    '',
    '## Evidence Model',
    '- Direct evidence: reproduction, logs, traces, metrics, failing tests, screenshots, config diffs, deploy history, or authoritative runbooks.',
    '- Indirect evidence: timing correlation, user reports, similar incidents, or model inference.',
    '- Contradicting evidence is as important as supporting evidence; use it to prune hypotheses.',
    '',
    '## Deliverables',
    '- A concise diagnosis with confidence level and evidence.',
    '- A mitigation or fix plan that names verification steps.',
    '- A follow-up list for prevention, monitoring, tests, runbooks, or product guardrails.',
  ].join('\n');
}

export function buildDebuggerSystemPrompt({
  workspaceName,
}: {
  workspaceName?: string;
}): string {
  return [
    buildAgentSystemPrompt({
      workspaceName,
      goal: 'Debug issues with structured triage, root-cause analysis, hypothesis tracking, mitigation, verification, and prevention follow-up.',
      scenario: 'coding',
      constraints: [
        'Treat debugging as cross-domain: code, data, configuration, dependencies, operations, UX, environment, and process can all be causes.',
        'Keep mitigation, root cause, and verification separate.',
      ],
    }),
    '## Debugger Operating Instructions',
    buildDebuggerOperatingInstructions(),
  ].join('\n\n');
}

export function buildDebuggerToolInstructions({
  workspaceName,
  workspacePromptContext,
  descriptors,
  selectedToolIds,
  selectedGroups,
}: {
  workspaceName: string;
  workspacePromptContext: string;
  descriptors: readonly Pick<ToolDescriptor, 'id' | 'label' | 'description'>[];
  selectedToolIds?: readonly string[];
  selectedGroups?: readonly string[];
}): string {
  return [
    buildDebuggerSystemPrompt({ workspaceName }),
    buildToolInstructionsTemplate({
      workspaceName,
      workspacePromptContext,
      descriptors,
      selectedToolIds,
      selectedGroups,
    }),
  ].join('\n\n');
}

export async function streamDebuggerChat(
  {
    runtimeProvider,
    model,
    modelId,
    sessionId,
    messages,
    workspaceName,
    workspacePromptContext,
    latestUserInput,
    voters = [],
  }: {
    runtimeProvider: ModelBackedAgentProvider;
    model?: HFModel;
    modelId?: string;
    sessionId?: string;
    messages: ChatMessage[];
    workspaceName: string;
    workspacePromptContext: string;
    latestUserInput: string;
    voters?: IVoter[];
  },
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const systemPrompt = buildDebuggerSystemPrompt({ workspaceName });

  if (runtimeProvider === 'ghcp') {
    if (!modelId || !sessionId) {
      throw new Error('Debugger GHCP chat requires a modelId and sessionId.');
    }

    await streamGhcpChat({
      modelId,
      sessionId,
      workspaceName,
      workspacePromptContext,
      messages,
      latestUserInput,
      voters,
      systemPrompt,
    }, callbacks, signal);
    return;
  }

  if (!model) {
    throw new Error('Debugger Codi chat requires a local model.');
  }

  await streamCodiChat({
    model,
    messages,
    workspaceName,
    workspacePromptContext,
    voters,
    systemPrompt,
  }, callbacks, signal);
}
