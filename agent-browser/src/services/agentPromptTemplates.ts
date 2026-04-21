import type { ToolDescriptor, ToolGroupDescriptor } from '../tools';

export type AgentScenario =
  | 'general-chat'
  | 'memory-recall'
  | 'coding'
  | 'harness-control'
  | 'tool-router'
  | 'tool-group-select'
  | 'tool-select'
  | 'delegation-coordinator'
  | 'delegation-breakdown'
  | 'delegation-assignment'
  | 'delegation-validation';

export type DelegationWorkerId = 'coordinator' | 'breakdown-agent' | 'assignment-agent' | 'validation-agent';

export function buildPersonaTemplate(): string {
  return [
    '## Persona',
    'Mirror the user\'s tone and pace without parodying them.',
    'Be friendly, modest, and collaborative.',
    'When uncertain, say what you are unsure about and ask for clarifying direction when that would improve the result.',
    'Act like a collaborator helping the user steer toward the best answer rather than pretending to know more than you do.',
  ].join('\n');
}

export function buildAlignmentTemplate({
  workspaceName,
  goal,
}: {
  workspaceName?: string;
  goal: string;
}): string {
  return [
    '## Alignment',
    workspaceName ? `Active workspace: ${workspaceName}` : null,
    `Primary goal: ${goal}`,
    'Stay aligned to the user\'s request, avoid unnecessary work, and prefer the smallest useful next action.',
    'If tradeoffs exist, keep them explicit and grounded in the current task.',
  ].filter(Boolean).join('\n');
}

export function buildMemoryRecallTemplate(): string {
  return [
    '## Memory / Recall Guidance',
    'Recall only the information relevant to the current request.',
    'Summarize prior context compactly before reusing it.',
    'When storing or repeating information, preserve the user\'s intent, key constraints, and unresolved questions.',
    'Call out uncertainty, stale context, or possible gaps in memory before relying on it.',
  ].join('\n');
}

export function buildCodingTemplate(): string {
  return [
    '## Coding Guidance',
    'Prefer concrete implementation steps over abstract advice.',
    'Write code that is minimal, testable, and consistent with the surrounding codebase.',
    'Verify assumptions, run focused tests when possible, and mention any remaining uncertainty or risk.',
    'When changing behavior, optimize for correctness first and keep the user informed about tradeoffs.',
  ].join('\n');
}

export function buildHarnessControlTemplate(): string {
  return [
    '## Agent Harness Control Guidance',
    'Reason in terms of workspaces, chat sessions, browser tabs, terminal mode, workspace files, and agent-browser surfaces.',
    'When controlling the harness, prefer precise actions that preserve workspace-scoped state and avoid leaking context across workspaces.',
    'If an action could affect multiple workspaces or sessions, state that explicitly and choose the narrowest safe scope.',
  ].join('\n');
}

function buildScenarioGuidance(scenario: AgentScenario): string {
  switch (scenario) {
    case 'memory-recall':
      return buildMemoryRecallTemplate();
    case 'coding':
      return buildCodingTemplate();
    case 'harness-control':
      return buildHarnessControlTemplate();
    case 'tool-router':
      return [
        '## Tool Routing Guidance',
        'Decide whether the request should be answered directly or routed into tool use.',
        'Keep the goal short and specific so downstream planners can stay aligned.',
      ].join('\n');
    case 'tool-group-select':
      return [
        '## Tool Group Selection Guidance',
        'Choose the smallest relevant tool groups and avoid broad tool exposure.',
        'Prefer narrow, task-specific groups over general fallback groups when possible.',
      ].join('\n');
    case 'tool-select':
      return [
        '## Tool Selection Guidance',
        'Choose the smallest specific tool set that can complete the task.',
        'Avoid redundant tools and select only tools you expect to use.',
      ].join('\n');
    case 'delegation-coordinator':
      return [
        '## Delegation Coordinator Guidance',
        'Choose one concrete multi-step problem from the user request that benefits from delegation.',
        'Keep the decomposition compact, executable, and grounded in the initial request.',
      ].join('\n');
    case 'delegation-breakdown':
      return [
        '## Delegation Breakdown Guidance',
        'Only break the chosen problem into parallel tracks.',
        'Do not assign owners or validate outcomes here; focus on decomposition only.',
      ].join('\n');
    case 'delegation-assignment':
      return [
        '## Delegation Assignment Guidance',
        'Only assign specialist roles, ownership boundaries, and handoffs.',
        'Do not restate the full plan; focus on who should do what and where overlap must be avoided.',
      ].join('\n');
    case 'delegation-validation':
      return [
        '## Delegation Validation Guidance',
        'Only identify risks, missing coverage, and validation checks.',
        'Focus on correctness, overlap, and how to confirm the delegated work succeeded.',
      ].join('\n');
    default:
      return [
        '## General Guidance',
        'Answer directly when possible and stay grounded in the current request and workspace context.',
      ].join('\n');
  }
}

export function resolveAgentScenario(text: string): Exclude<AgentScenario, 'tool-router' | 'tool-group-select' | 'tool-select' | 'delegation-coordinator' | 'delegation-breakdown' | 'delegation-assignment' | 'delegation-validation'> {
  const lowered = text.toLowerCase();

  if (/(remember|recall|summari[sz]e|store|memory|notes?)/.test(lowered)) {
    return 'memory-recall';
  }

  if (/(code|implement|fix|refactor|test|debug|build|typescript|javascript|python)/.test(lowered)) {
    return 'coding';
  }

  if (/(agent-browser|workspace|browser tab|terminal mode|chat session|harness|session fs|files tree)/.test(lowered)) {
    return 'harness-control';
  }

  return 'general-chat';
}

export function buildAgentSystemPrompt({
  workspaceName,
  goal,
  scenario,
}: {
  workspaceName?: string;
  goal: string;
  scenario: AgentScenario;
}): string {
  return [
    buildPersonaTemplate(),
    buildAlignmentTemplate({ workspaceName, goal }),
    buildScenarioGuidance(scenario),
  ].join('\n\n');
}

export function buildToolInstructionsTemplate({
  workspaceName,
  workspacePromptContext,
  descriptors,
}: {
  workspaceName: string;
  workspacePromptContext: string;
  descriptors: readonly Pick<ToolDescriptor, 'id' | 'label' | 'description'>[];
}): string {
  const lines = [
    buildAgentSystemPrompt({
      workspaceName,
      goal: 'Use tools only when they materially improve the answer and then respond with a concise, grounded result.',
      scenario: 'coding',
    }),
    buildHarnessControlTemplate(),
    '## Tool Instructions',
    workspacePromptContext,
    'Use only the current available tools listed below. Each tool call is visible to the user, so prefer the smallest useful set.',
    'For Files tools, use locations exactly as shown in the Files tree, including workspace paths like //workspace/AGENTS.md and session filesystem locations like //session-1-fs/workspace.',
    'For cli, prefer short, non-interactive bash commands. Do not use cli for clear or long-running interactive shells.',
    'After any tool usage, summarize what you found or changed and note any uncertainty.',
    '',
    'Available tools:',
    ...descriptors.map((descriptor) => `- ${descriptor.id} (${descriptor.label}): ${descriptor.description}`),
  ];

  return lines.filter(Boolean).join('\n\n');
}

export function buildToolRouterPrompt({ instructions, workspaceName }: { instructions: string; workspaceName?: string }): string {
  return [
    buildAgentSystemPrompt({
      workspaceName,
      goal: 'Route the request to direct chat or tool use.',
      scenario: 'tool-router',
    }),
    'Respond with JSON only: {"mode":"tool-use"|"chat","goal":"<short goal>"}',
    instructions,
  ].join('\n\n');
}

export function buildToolGroupSelectionPrompt({
  groups,
  workspaceName,
}: {
  groups: ToolGroupDescriptor[];
  workspaceName?: string;
}): string {
  return [
    buildAgentSystemPrompt({
      workspaceName,
      goal: 'Choose the smallest set of tool groups needed for the task.',
      scenario: 'tool-group-select',
    }),
    'Respond with JSON only: {"groups":["<group-id>"],"goal":"<short goal>"}',
    'Available groups:',
    ...groups.map((group) => `- ${group.id} (${group.label}) [${group.toolIds.length} tools]: ${group.description}`),
  ].join('\n\n');
}

export function buildToolSelectorPrompt({
  descriptors,
  workspaceName,
}: {
  descriptors: Array<Pick<ToolDescriptor, 'id' | 'label' | 'description'>>;
  workspaceName?: string;
}): string {
  return [
    buildAgentSystemPrompt({
      workspaceName,
      goal: 'Choose the smallest set of specific tools needed for the task.',
      scenario: 'tool-select',
    }),
    'Respond with JSON only: {"toolIds":["<tool-id>"],"goal":"<short goal>"}',
    'Available tools:',
    ...descriptors.map((descriptor) => `- ${descriptor.id} (${descriptor.label}): ${descriptor.description}`),
  ].join('\n\n');
}

export function buildDelegationWorkerPrompt({
  workspaceName,
  worker,
}: {
  workspaceName: string;
  worker: DelegationWorkerId;
}): string {
  const scenarioMap: Record<DelegationWorkerId, AgentScenario> = {
    coordinator: 'delegation-coordinator',
    'breakdown-agent': 'delegation-breakdown',
    'assignment-agent': 'delegation-assignment',
    'validation-agent': 'delegation-validation',
  };

  const goalMap: Record<DelegationWorkerId, string> = {
    coordinator: 'Choose the one concrete delegated problem to solve from the initial user prompt.',
    'breakdown-agent': 'Decompose the delegated problem into parallel work tracks with no overlap.',
    'assignment-agent': 'Assign specialist roles, ownership boundaries, and handoffs.',
    'validation-agent': 'Identify risks, missing coverage, and validation checks.',
  };

  return [
    buildAgentSystemPrompt({
      workspaceName,
      goal: goalMap[worker],
      scenario: scenarioMap[worker],
    }),
    `delegation-worker:${worker}`,
  ].join('\n\n');
}

export function buildDelegationWorkerTask({
  worker,
  userPrompt,
  coordinatorProblem,
}: {
  worker: Exclude<DelegationWorkerId, 'coordinator'>;
  userPrompt: string;
  coordinatorProblem: string;
}): string {
  const shared = [
    `Original user request: ${userPrompt}`,
    `Chosen delegation problem: ${coordinatorProblem}`,
  ];

  switch (worker) {
    case 'breakdown-agent':
      return [
        ...shared,
        'Assigned task: break the chosen problem into 2-3 concise parallel tracks with no overlapping ownership.',
        'Output only bullet points for the tracks.',
      ].join('\n\n');
    case 'assignment-agent':
      return [
        ...shared,
        'Assigned task: assign each track to a specialist subagent, define its objective, and make handoffs explicit.',
        'Output only bullet points in the form "Role: task and handoff".',
      ].join('\n\n');
    case 'validation-agent':
      return [
        ...shared,
        'Assigned task: identify risks, missing coverage, and concrete validation checks for the delegated work.',
        'Output only bullet points for risks and checks.',
      ].join('\n\n');
  }
}