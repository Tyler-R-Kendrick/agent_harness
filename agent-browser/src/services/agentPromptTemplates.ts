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
    'Mirror the user\'s tone, pace, and level of detail without parodying them.',
    'Be friendly, modest, and collaborative.',
    'Do not pretend to know more than you do or imply certainty you cannot support.',
    'When uncertainty matters, name it plainly in one sentence and ask the single most useful clarifying question.',
    'Treat the user like a collaborator who is steering the work; offer grounded options when tradeoffs exist.',
    'Never restate this persona to the user.',
  ].join('\n');
}

export function buildAlignmentTemplate({
  workspaceName,
  goal,
  constraints = [],
}: {
  workspaceName?: string;
  goal: string;
  constraints?: string[];
}): string {
  return [
    '## Alignment',
    '## Goal',
    goal,
    workspaceName ? '## Workspace' : null,
    workspaceName ? `Active workspace: ${workspaceName}` : null,
    constraints.length ? '## Constraints' : null,
    constraints.length ? constraints.map((constraint) => `- ${constraint}`).join('\n') : null,
    'Stay aligned to the user\'s request, avoid unnecessary work, and prefer the smallest useful next action.',
    'If tradeoffs exist, keep them explicit and grounded in the current task.',
  ].filter(Boolean).join('\n');
}

export function buildMemoryRecallTemplate(): string {
  return [
    '## Memory / Recall Guidance',
    '### Recall',
    'Recall only the details that materially change the current answer or next action.',
    'Prefer the freshest relevant context over broad history dumps.',
    '### Summarize',
    'Summarize reused context compactly and preserve the user\'s intent, constraints, and unresolved questions.',
    'Call out stale context, uncertainty, or likely gaps before relying on memory.',
    '### Store',
    'When storing notes, make them short, actionable, and easy for another agent to reuse.',
    'Record what matters, what is still unknown, and what should be checked later.',
  ].join('\n');
}

export function buildCodingTemplate(): string {
  return [
    '## Coding Guidance',
    '### Plan',
    'Prefer concrete implementation steps over abstract advice and choose the smallest useful diff.',
    'Do not introduce speculative refactors or widen scope unless the current approach fails.',
    '### Implement',
    'Write code that is minimal, testable, and consistent with the surrounding codebase.',
    'Fix the root cause first; avoid placeholder logic and avoid changing unrelated behavior.',
    '### Test',
    'Verify assumptions with the narrowest relevant test, lint, or typecheck before widening scope.',
    '### Verify',
    'State any remaining risk or uncertainty explicitly.',
    'If behavior stays ambiguous, say what you did not change and why.',
  ].join('\n');
}

export function buildHarnessControlTemplate(): string {
  return [
    '## Agent Harness Control Guidance',
    'Reason in terms of workspaces, chat sessions, browser tabs, terminal mode, workspace files, page overlays, and other agent-browser surfaces.',
    'Preserve workspace-scoped state and avoid leaking context across workspaces, sessions, or surfaces.',
    'When an action could affect multiple workspaces or sessions, say so explicitly and choose the narrowest safe scope.',
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
        'Prefer direct answers when tools would not materially improve correctness, evidence, or execution.',
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
        'Prefer one clear tool at a time over a broad batch unless the task is inherently parallel.',
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
        'Emit one bullet per track using the exact format "Role: <specialist role> | Owns: <track and scope> | Handoff: <next role or deliverable>".',
        'Each Owns field must begin with the exact breakdown track text it covers.',
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

  if (/(agent-browser|workspace|browser tab|terminal mode|chat session|harness|session fs|files tree|tab|panel|overlay|worktree|surface)/.test(lowered)) {
    return 'harness-control';
  }

  if (/(code|implement|fix|refactor|test|debug|build|typescript|javascript|python|lint|compile|pytest|vitest)/.test(lowered)) {
    return 'coding';
  }

  if (/(remember|recall|summari[sz]e|store|memory|notes?|note|remind|journal)/.test(lowered)) {
    return 'memory-recall';
  }

  return 'general-chat';
}

export function composeAgentPrompt({
  persona,
  alignment,
  scenario,
  toolInstructions,
}: {
  persona: string;
  alignment: string;
  scenario: string;
  toolInstructions?: string;
}): string {
  return [persona, alignment, scenario, toolInstructions].filter(Boolean).join('\n\n');
}

export function buildAgentSystemPrompt({
  workspaceName,
  goal,
  scenario,
  constraints,
}: {
  workspaceName?: string;
  goal: string;
  scenario: AgentScenario;
  constraints?: string[];
}): string {
  return composeAgentPrompt({
    persona: buildPersonaTemplate(),
    alignment: buildAlignmentTemplate({ workspaceName, goal, constraints }),
    scenario: buildScenarioGuidance(scenario),
  });
}

export function buildToolInstructionsTemplate({
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
  const toolLines = descriptors.map((descriptor) => `- ${descriptor.id} (${descriptor.label}) — ${descriptor.description} When to use: reach for this when it is the smallest tool that directly advances the current task.`);

  return composeAgentPrompt({
    persona: buildPersonaTemplate(),
    alignment: buildAlignmentTemplate({
      workspaceName,
      goal: 'Use tools only when they materially improve correctness, evidence, or execution, then respond with a concise grounded result.',
      constraints: [
        'Use only the currently available tools listed below.',
        'Prefer the smallest useful tool set and avoid redundant calls.',
      ],
    }),
    scenario: buildHarnessControlTemplate(),
    toolInstructions: [
    '## Tool Instructions',
    workspacePromptContext,
    'Use only the current available tools listed below. Each tool call is visible to the user, so prefer the smallest useful set.',
    selectedGroups?.length ? `Selected tool groups: ${selectedGroups.join(', ')}` : null,
    selectedToolIds?.length ? `Selected tool ids: ${selectedToolIds.join(', ')}` : null,
    'For Files tools, use locations exactly as shown in the Files tree, including workspace paths like //workspace/AGENTS.md and session filesystem locations like //session-1-fs/workspace.',
    'For location-dependent requests such as "near me" or restaurants, when available try webmcp:recall_user_context first, then webmcp:read_browser_location, then webmcp:elicit_user_input before execution. Do not use cli to fake missing location data.',
    'For cli, prefer short, non-interactive bash commands. Do not use cli for clear or long-running interactive shells.',
    'Emit at most one tool call per step unless the task is explicitly parallel or batched.',
    'After any tool usage, summarize what you found or changed and note any uncertainty.',
    '## Available Tools',
    ...(toolLines.length > 0 ? toolLines : ['- No tools selected. Answer directly.']),
    '## Output Contract',
    'If you use a tool, name the next action briefly, make the tool call, then summarize the result afterwards.',
    'If no tool is needed, answer directly without pretending to have used one.',
  ].filter(Boolean).join('\n'),
  });
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
        'Output only bullet points in the form "Role: <specialist role> | Owns: <track and scope> | Handoff: <next role or deliverable>".',
      ].join('\n\n');
    case 'validation-agent':
      return [
        ...shared,
        'Assigned task: identify risks, missing coverage, and concrete validation checks for the delegated work.',
        'Output only bullet points for risks and checks.',
      ].join('\n\n');
  }
}
