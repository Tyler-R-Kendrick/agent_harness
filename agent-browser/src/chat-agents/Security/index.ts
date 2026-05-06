import type { IVoter } from 'logact';
import type { ChatMessage, HFModel } from '../../types';
import type { ToolDescriptor } from '../../tools';
import { buildAgentSystemPrompt, buildToolInstructionsTemplate } from '../../services/agentPromptTemplates';
import { streamCodexChat } from '../Codex';
import { streamCodiChat } from '../Codi';
import { streamCursorAgentChat } from '../Cursor';
import { streamGhcpChat } from '../Ghcp';
import type { AgentStreamCallbacks, ModelBackedAgentProvider } from '../types';

export const SECURITY_REVIEW_LABEL = 'Security Review';

export function isSecurityReviewTaskText(text: string): boolean {
  return /\b(security review|vulnerability scan|vulnerability scanner|secret leak|secret scan|auth regression|authentication regression|authorization|privacy|data handling|prompt injection|unsafe auto[- ]?approval|sast|sca|dependency audit|dependency vuln|exposed secret)\b/i.test(text);
}

export function buildSecurityReviewOperatingInstructions(): string {
  return [
    '# Security Review',
    '',
    '## Purpose',
    '- Review pull-request diffs and scheduled repository state for security regressions inside the Agent Browser workflow.',
    '',
    '## Goals',
    '- Identify auth regressions, privacy and data-handling risks, prompt injection, unsafe agent auto-approvals, exposed secrets, dependency vulnerabilities, and insecure tool delegation.',
    '- Emit severity-tagged findings with direct evidence, affected surface, exploit path, and remediation guidance.',
    '- Prefer inline PR findings when reviewing diffs and scheduled scan summaries when reviewing repository state.',
    '- Integrate selected harness, MCP, SAST, SCA, secret-scanning, and audit tools when available before making claims.',
    '',
    '## Constraints',
    '- Do not report vague best-practice advice as a finding without a concrete affected file, behavior, or configuration.',
    '- Do not downgrade credential, authorization, or unsafe auto-approval risks without evidence.',
    '- Keep severity explicit: critical, high, medium, or low.',
    '',
    '## Workflow',
    '1. Classify the review target as PR diff, scheduled repository scan, dependency scan, secret scan, or policy review.',
    '2. Inventory available evidence and selected security tools.',
    '3. Check auth, privacy/data handling, prompt injection, agent auto-approval, dependency, and secret exposure surfaces.',
    '4. Produce severity-tagged findings with remediation, verification steps, and any blocked-tool gaps.',
    '5. End with a concise scan/update summary suitable for Agent Browser review and automation surfaces.',
    '',
    '## Deliverables',
    '- Severity-tagged findings.',
    '- Remediation guidance.',
    '- Verification steps.',
    '- Scheduled scan status when cadence-based review is requested.',
  ].join('\n');
}

export function buildSecurityReviewSystemPrompt({
  workspaceName,
  modelId,
}: {
  workspaceName?: string;
  modelId?: string;
}): string {
  return [
    buildAgentSystemPrompt({
      workspaceName,
      goal: 'Review code, pull requests, dependencies, tools, and repository state for security regressions with severity-tagged remediation guidance.',
      scenario: 'coding',
      constraints: [
        'Ground each finding in concrete evidence.',
        'Keep severity, remediation, and verification steps explicit.',
      ],
      agentKind: 'security-review',
      modelId,
    }),
    '## Security Review Operating Instructions',
    buildSecurityReviewOperatingInstructions(),
  ].join('\n\n');
}

export function buildSecurityReviewToolInstructions({
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
    buildSecurityReviewSystemPrompt({ workspaceName }),
    buildToolInstructionsTemplate({
      workspaceName,
      workspacePromptContext,
      descriptors,
      selectedToolIds,
      selectedGroups,
    }),
  ].join('\n\n');
}

export async function streamSecurityReviewChat(
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
  const systemPrompt = buildSecurityReviewSystemPrompt({
    workspaceName,
    modelId: runtimeProvider === 'codi' ? model?.id : modelId,
  });

  if (runtimeProvider === 'ghcp') {
    if (!modelId || !sessionId) {
      throw new Error('Security Review GHCP chat requires a modelId and sessionId.');
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

  if (runtimeProvider === 'cursor') {
    if (!modelId || !sessionId) {
      throw new Error('Security Review Cursor chat requires a modelId and sessionId.');
    }
    await streamCursorAgentChat({
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

  if (runtimeProvider === 'codex') {
    if (!modelId || !sessionId) {
      throw new Error('Security Review Codex chat requires a modelId and sessionId.');
    }
    await streamCodexChat({
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
    throw new Error('Security Review Codi chat requires a local model.');
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
