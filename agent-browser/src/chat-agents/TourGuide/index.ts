import { PayloadType } from 'logact';
import type { ChatMessage } from '../../types';
import { createObservedBus } from '../../services/observedAgentBus';
import {
  DEFAULT_TOUR_TARGETS,
  buildGuidedTourPlan,
  type GuidedTourPlan,
  type TourTargetDescriptor,
} from '../../features/tours/driverTour';
import type { AgentStreamCallbacks } from '../types';

export const TOUR_GUIDE_AGENT_ID = 'tour-guide';
export const TOUR_GUIDE_LABEL = 'Tour Guide';

export interface TourGuidePolicyEvalResult {
  passed: boolean;
  score: number;
  checks: {
    referencesDriverJs: boolean;
    usesKnownTargetRegistry: boolean;
    emitsStructuredTourPlan: boolean;
    includesAgentBusTelemetry: boolean;
    rejectsUnsafeSelectors: boolean;
  };
}

export function isTourGuideTaskText(text: string): boolean {
  return /\b(tour|tutorial|walkthrough|walk me through|guide me through|show me how to (use|configure)|help me use|how do i use|where (is|are) the|what does .*(button|selector|panel|tab|control))\b/i.test(text);
}

export function buildTourGuideAgentPrompt({
  task,
  targets = DEFAULT_TOUR_TARGETS,
  workspaceName,
}: {
  task: string;
  targets?: readonly TourTargetDescriptor[];
  workspaceName?: string;
}): string {
  const registry = targets
    .map((target) => `- ${target.id}: ${target.label} -> ${target.selector} (${target.description})`)
    .join('\n');
  return [
    `Role: ${TOUR_GUIDE_AGENT_ID} chat-agent`,
    `Workspace: ${workspaceName ?? 'active workspace'}`,
    `User task: ${task}`,
    '',
    'Mission: create a driver.js guided product tour for the visible Agent Browser feature the user is asking about.',
    '',
    'Use the known target registry only; do not invent free-form DOM selectors.',
    registry,
    '',
    'structured tour plan contract:',
    '- Return a plan with id, title, description, and steps.',
    '- Each step must reference a known target id and its exact selector.',
    '- Each popover must have a short title and useful description.',
    '- sanitize any generated plan against the known target registry before running driver.js.',
    '',
    'AgentBus telemetry:',
    '- Append Mail, Policy, Intent, Commit, Result, and Completion entries for each tour request.',
    '- The Policy entry must record driver.js, known target registry use, and unsafe selector rejection.',
    '',
    'Safety rules:',
    '- Reject unsafe selectors, querySelectorAll(\'*\'), eval, document.body.innerHTML, and arbitrary DOM mutation.',
    '- Prefer visible targets; if no targets are mounted, return a modal-only fallback step instead of failing silently.',
    '- Do not use external web search to explain local UI.',
  ].join('\n');
}

export function evaluateTourGuideAgentPolicy({ prompt }: { prompt: string }): TourGuidePolicyEvalResult {
  const checks = {
    referencesDriverJs: /driver\.js/i.test(prompt),
    usesKnownTargetRegistry: /known target registry/i.test(prompt) && /Agent provider/.test(prompt),
    emitsStructuredTourPlan: /Structured tour plan contract/i.test(prompt) && /\bsteps\b/.test(prompt),
    includesAgentBusTelemetry: /AgentBus telemetry/i.test(prompt) && /Mail, Policy, Intent, Commit, Result, and Completion/.test(prompt),
    rejectsUnsafeSelectors: /Reject unsafe selectors/i.test(prompt) && /querySelectorAll\('\*'\)/.test(prompt),
  };
  const passedChecks = Object.values(checks).filter(Boolean).length;
  return {
    passed: passedChecks === Object.keys(checks).length,
    score: passedChecks / Object.keys(checks).length,
    checks,
  };
}

export async function streamTourGuideChat(
  {
    messages,
    latestUserInput,
    workspaceName,
    workspacePromptContext,
    targets = DEFAULT_TOUR_TARGETS,
  }: {
    messages: ChatMessage[];
    latestUserInput: string;
    workspaceName: string;
    workspacePromptContext: string;
    targets?: readonly TourTargetDescriptor[];
  },
  callbacks: AgentStreamCallbacks,
  _signal?: AbortSignal,
): Promise<void> {
  void workspacePromptContext;
  const input = latestUserInput || messages.at(-1)?.streamedContent || messages.at(-1)?.content || '';
  const prompt = buildTourGuideAgentPrompt({ task: input, targets, workspaceName });
  const plan = buildGuidedTourPlan({ request: input, targets });
  const intentId = `tour:${plan.id}`;
  const bus = createObservedBus(callbacks.onBusEntry);
  const meta = {
    actorId: TOUR_GUIDE_AGENT_ID,
    actorRole: 'chat-agent',
    branchId: `agent:${TOUR_GUIDE_AGENT_ID}`,
    agentLabel: TOUR_GUIDE_LABEL,
    modelProvider: TOUR_GUIDE_AGENT_ID,
  };

  await bus.append({
    type: PayloadType.Mail,
    from: 'user',
    content: input,
    meta: { ...meta, actorRole: 'user', actorId: 'user', branchId: 'mail:user' },
  });
  await bus.append({
    type: PayloadType.Policy,
    target: TOUR_GUIDE_AGENT_ID,
    value: {
      library: 'driver.js',
      prompt,
      knownTargetIds: targets.map((target) => target.id),
      unsafeSelectorsRejected: true,
    },
    meta: { ...meta, actorRole: 'policy' },
  });
  await bus.append({
    type: PayloadType.Intent,
    intentId,
    action: `Create and start driver.js guided tour "${plan.title}".`,
    meta,
  });
  await bus.append({
    type: PayloadType.Commit,
    intentId,
    meta: { ...meta, actorRole: 'decider', actorId: 'tour-guide-decider', parentActorId: TOUR_GUIDE_AGENT_ID },
  });

  callbacks.onTourPlan?.(plan);
  const finalText = renderTourGuideResponse(plan);
  callbacks.onToken?.(finalText);

  await bus.append({
    type: PayloadType.Result,
    intentId,
    output: JSON.stringify(plan),
    meta: { ...meta, actorRole: 'executor', actorId: 'tour-guide-driverjs', parentActorId: TOUR_GUIDE_AGENT_ID },
  });
  await bus.append({
    type: PayloadType.Completion,
    intentId,
    done: true,
    score: 'high',
    feedback: `Started driver.js tour "${plan.title}".`,
    meta: { ...meta, actorRole: 'completion-checker', actorId: 'tour-guide-completion', parentActorId: TOUR_GUIDE_AGENT_ID },
  });

  callbacks.onDone?.(finalText);
}

function renderTourGuideResponse(plan: GuidedTourPlan): string {
  const targetLabels = plan.steps.map((step) => step.popover.title).join(', ');
  return `Started a guided tour: ${plan.title}. It will highlight ${targetLabels}.`;
}
