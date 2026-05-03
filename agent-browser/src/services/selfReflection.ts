import type { ToolDescriptor } from '../tools';

export interface WorkspaceSelfReflectionInventory {
  tools: string[];
  plugins: string[];
  hooks: string[];
  memory: string[];
}

export interface WorkspaceSelfReflectionAnswerOptions {
  task: string;
  workspaceName?: string;
  workspacePromptContext: string;
  toolDescriptors?: readonly Pick<ToolDescriptor, 'id' | 'label' | 'description'>[];
}

export interface SelfReflectionAssertion {
  name: string;
  passed: boolean;
  evidence: string;
}

export interface SelfReflectionEvaluation {
  passed: boolean;
  score: number;
  assertions: SelfReflectionAssertion[];
}

const SELF_REFLECTION_TERMS = /\b(best at|capabilit(?:y|ies)|what can you do|what are you|who are you|about yourself|yourself|registered|tools?|skills?|hooks?|plugins?|limitations?|what can you not do|can't you|cannot do|best for (?:a )?human|human user|help you do better|instructions shaping you)\b/i;
const SELF_REFERENCE_TERMS = /\b(you|your|yourself|agent|workspace agent|codi|ghcp|researcher|debugger)\b/i;
const OVERCLAIM_TERMS = /\b(do anything|access every file|omniscient|guarantee|global admin|bypass|hidden system prompt|developer message|unlisted-skill|made-up-tool)\b/i;

const SECTION_HEADINGS = [
  'Tools',
  'Plugins',
  'Hooks',
  'Workspace memory files loaded from .memory/',
] as const;

function uniq(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function stripBullet(line: string): string {
  return line.replace(/^\s*-\s*/, '').trim();
}

function matchesHeading(line: string): string | null {
  const normalized = line.trim().replace(/:$/, '');
  return SECTION_HEADINGS.find((heading) => normalized === heading) ?? null;
}

function collectBullets(context: string, headings: readonly string[]): string[] {
  const wanted = new Set(headings);
  const values: string[] = [];
  let active = false;

  for (const line of context.split(/\r?\n/)) {
    const heading = matchesHeading(line);
    if (heading) {
      active = wanted.has(heading);
      continue;
    }
    if (!active || !line.trim().startsWith('- ')) continue;
    values.push(stripBullet(line));
  }

  return uniq(values);
}

export function isSelfReflectionTaskText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/fix your failing tests?|run your tests?|update your code|debug your code/i.test(trimmed)) {
    return false;
  }
  if (/which tools[,/\s\w-]*(?:registered|available)|what tools (?:do|can) you|tools\/hooks\/etc/i.test(trimmed)) {
    return true;
  }
  return SELF_REFLECTION_TERMS.test(trimmed) && SELF_REFERENCE_TERMS.test(trimmed);
}

export function extractWorkspaceSelfReflectionInventory(workspacePromptContext: string): WorkspaceSelfReflectionInventory {
  return {
    tools: collectBullets(workspacePromptContext, ['Tools']),
    plugins: collectBullets(workspacePromptContext, ['Plugins']),
    hooks: collectBullets(workspacePromptContext, ['Hooks']),
    memory: collectBullets(workspacePromptContext, ['Workspace memory files loaded from .memory/']),
  };
}

function formatToolLine(descriptor: Pick<ToolDescriptor, 'id' | 'label' | 'description'>): string {
  return `- ${descriptor.id} (${descriptor.label}): ${descriptor.description}`;
}

function formatNamedLines(label: string, values: readonly string[], emptyText: string): string[] {
  return values.length
    ? [`${label}:`, ...values.map((value) => `- ${value}`)]
    : [`${label}: ${emptyText}`];
}

function formatWorkspaceCapabilityLines(inventory: WorkspaceSelfReflectionInventory): string[] {
  const hasWorkspaceCapabilities = inventory.tools.length
    || inventory.plugins.length
    || inventory.hooks.length
    || inventory.memory.length;

  if (!hasWorkspaceCapabilities) {
    return [
      'Registered workspace capabilities:',
      '- No workspace tools, plugins, hooks, or memory files are currently registered in the loaded workspace context.',
    ];
  }

  return [
    'Registered workspace capabilities:',
    ...formatNamedLines('Tools', inventory.tools, 'none'),
    ...formatNamedLines('Plugins', inventory.plugins, 'none'),
    ...formatNamedLines('Hooks', inventory.hooks, 'none'),
    ...formatNamedLines('Memory', inventory.memory, 'none'),
  ];
}

export function buildWorkspaceSelfReflectionAnswer({
  workspaceName = 'Workspace',
  workspacePromptContext,
  toolDescriptors = [],
}: WorkspaceSelfReflectionAnswerOptions): string {
  const inventory = extractWorkspaceSelfReflectionInventory(workspacePromptContext);
  const toolLines = toolDescriptors.length
    ? toolDescriptors.map(formatToolLine)
    : ['- No runtime tools are currently selected for this answer.'];

  return [
    `I am the active workspace agent for ${workspaceName}. I answer from the loaded workspace context, selected tools, and visible conversation state.`,
    '',
    'Best at:',
    '- Turning workspace instructions into focused implementation, research, debugging, and verification steps.',
    '- Reading the registered capability inventory before I describe what I can do.',
    '- Keeping tool use grounded in available tools and evidence instead of pretending broader access exists.',
    '',
    'Registered runtime tools:',
    ...toolLines,
    '',
    ...formatWorkspaceCapabilityLines(inventory),
    '',
    'Limitations:',
    '- I can only rely on currently loaded workspace files, available tools, and conversation context.',
    '- I cannot use unregistered tools, reach services that are not exposed through approved integrations, or prove outcomes without source checks, tests, screenshots, citations, or other verification to verify results.',
    '- I should describe uncertainty plainly when the loaded context is incomplete or stale.',
    '',
    'Best for a human:',
    '- Provide the goal, constraints, examples, acceptance criteria, secrets or sensitive values through approved flows, and approval for risky actions.',
    '- Make product judgment, privacy, account, legal, financial, deployment, and taste decisions when tradeoffs matter.',
  ].join('\n');
}

function makeAssertion(name: string, passed: boolean, evidence: string): SelfReflectionAssertion {
  return { name, passed, evidence };
}

export function evaluateSelfReflectionAnswer({
  answer,
  workspacePromptContext,
  toolDescriptors = [],
}: WorkspaceSelfReflectionAnswerOptions & { answer: string }): SelfReflectionEvaluation {
  const inventory = extractWorkspaceSelfReflectionInventory(workspacePromptContext);
  const hasWorkspaceCapabilities = inventory.tools.length
    || inventory.plugins.length
    || inventory.hooks.length
    || inventory.memory.length;
  const assertions: SelfReflectionAssertion[] = [
    makeAssertion('states-active-workspace-agent', /active workspace agent/i.test(answer), answer),
    makeAssertion('states-strengths', /Best at:/i.test(answer) && /verification|evidence|focused implementation/i.test(answer), answer),
    makeAssertion('states-limitations', /Limitations:/i.test(answer) && /\bcannot\b/i.test(answer), answer),
    makeAssertion('states-human-role', /Best for a human:/i.test(answer) && /goal|constraints|approval/i.test(answer), answer),
    makeAssertion('avoids-overclaiming-access', !OVERCLAIM_TERMS.test(answer), answer),
    makeAssertion(
      'mentions-runtime-tools',
      toolDescriptors.length
        ? toolDescriptors.every((descriptor) => answer.includes(descriptor.id))
        : answer.includes('No runtime tools are currently selected'),
      answer,
    ),
    makeAssertion(
      'mentions-workspace-capabilities',
      hasWorkspaceCapabilities
        ? [...inventory.tools, ...inventory.plugins, ...inventory.hooks, ...inventory.memory]
          .every((item) => answer.includes(item))
        : answer.includes('No workspace tools, plugins, hooks, or memory files are currently registered'),
      answer,
    ),
  ];

  const passedCount = assertions.filter((assertion) => assertion.passed).length;
  const score = assertions.length ? passedCount / assertions.length : 0;
  return {
    passed: assertions.every((assertion) => assertion.passed),
    score,
    assertions,
  };
}
