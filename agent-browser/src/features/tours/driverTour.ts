import { driver } from 'driver.js';


export type TourPopoverSide = 'top' | 'right' | 'bottom' | 'left';
export type TourPopoverAlign = 'start' | 'center' | 'end';

export interface TourTargetDescriptor {
  id: string;
  label: string;
  selector: string;
  description: string;
  keywords: string[];
  side?: TourPopoverSide;
  align?: TourPopoverAlign;
}

export interface GuidedTourStep {
  targetId: string;
  element: string;
  popover: {
    title: string;
    description: string;
    side?: TourPopoverSide;
    align?: TourPopoverAlign;
  };
}

export interface GuidedTourPlan {
  id: string;
  title: string;
  description: string;
  steps: GuidedTourStep[];
}

export interface StartDriverTourResult {
  started: boolean;
  stepCount: number;
  skippedTargetIds: string[];
  error?: string;
}

interface BuildGuidedTourPlanInput {
  request: string;
  targets?: readonly TourTargetDescriptor[];
}

interface DriverStep {
  element?: string;
  popover: {
    title: string;
    description: string;
    side?: TourPopoverSide;
    align?: TourPopoverAlign;
  };
}

interface StartDriverTourOptions {
  root?: Pick<Document, 'querySelector'>;
  driverFactory?: typeof driver;
}

const MAX_TOUR_STEPS = 6;

export const DEFAULT_TOUR_TARGETS: TourTargetDescriptor[] = [
  {
    id: 'tools-picker',
    label: 'Configure tools',
    selector: 'button[aria-label^="Configure tools"]',
    description: 'Open this control to choose the tools available to the next agent turn.',
    keywords: ['tool', 'tools', 'configure', 'picker', 'capability', 'capabilities'],
    side: 'left',
    align: 'start',
  },
  {
    id: 'agent-provider',
    label: 'Agent provider',
    selector: '[aria-label="Agent provider"]',
    description: 'Switch between Codi, GHCP, specialist agents, and guided tour help.',
    keywords: ['agent', 'provider', 'selector', 'model', 'codi', 'ghcp', 'tour guide'],
    side: 'bottom',
    align: 'start',
  },
  {
    id: 'chat-input',
    label: 'Chat input',
    selector: '[aria-label="Chat input"]',
    description: 'Type the next request here; Tour Guide can answer by highlighting visible controls.',
    keywords: ['chat', 'input', 'prompt', 'message', 'ask', 'send', 'composer'],
    side: 'top',
    align: 'center',
  },
  {
    id: 'primary-navigation',
    label: 'Primary navigation',
    selector: '[aria-label="Primary navigation"]',
    description: 'Use this rail to move between projects, history, extensions, settings, and account views.',
    keywords: ['project', 'workspace', 'navigation', 'nav', 'sidebar', 'activity', 'history', 'settings'],
    side: 'right',
    align: 'start',
  },
  {
    id: 'omnibar',
    label: 'Omnibar',
    selector: '[aria-label="Omnibar"]',
    description: 'Search or enter a URL from the active workspace toolbar.',
    keywords: ['omnibar', 'url', 'search', 'address', 'browser'],
    side: 'bottom',
    align: 'start',
  },
  {
    id: 'workspace-switcher',
    label: 'Project switcher',
    selector: '[aria-label="Open projects"]',
    description: 'Open the project switcher to switch, create, or rename projects.',
    keywords: ['project', 'workspace', 'switcher', 'overlay', 'switch', 'create project', 'create workspace'],
    side: 'bottom',
    align: 'start',
  },
  {
    id: 'chat-mode',
    label: 'Chat mode',
    selector: '[aria-label="Chat mode"]',
    description: 'Return the shared console to the chat transcript and composer.',
    keywords: ['chat', 'mode', 'tab', 'switch'],
    side: 'top',
    align: 'center',
  },
  {
    id: 'terminal-mode',
    label: 'Terminal mode',
    selector: '[aria-label="Terminal mode"]',
    description: 'Switch the shared console into terminal mode for shell commands.',
    keywords: ['terminal', 'shell', 'bash', 'mode', 'tab', 'switch'],
    side: 'top',
    align: 'center',
  },
];

const TOUR_RECIPES: Array<{
  id: string;
  title: string;
  description: string;
  pattern: RegExp;
  targetIds: string[];
}> = [
  {
    id: 'tools',
    title: 'Configure Tools',
    description: 'Choose the agent, pick tools, and send a prompt with the right capabilities enabled.',
    pattern: /\b(tool|tools|configure|capabilit(?:y|ies)|picker)\b/i,
    targetIds: ['tools-picker', 'agent-provider', 'chat-input'],
  },
  {
    id: 'workspace',
    title: 'Workspace Navigation',
    description: 'Find the workspace controls, omnibar, and navigation rail.',
    pattern: /\b(workspace|navigation|navigate|omnibar|url|sidebar|activity|switcher)\b/i,
    targetIds: ['primary-navigation', 'omnibar', 'workspace-switcher', 'chat-input'],
  },
  {
    id: 'agent-provider',
    title: 'Choose An Agent',
    description: 'Pick the right chat agent and send a focused request.',
    pattern: /\b(agent provider|provider selector|agent selector|model selector|codi|ghcp|tour guide)\b/i,
    targetIds: ['agent-provider', 'chat-input'],
  },
  {
    id: 'modes',
    title: 'Switch Console Modes',
    description: 'Move between chat and terminal in the shared console.',
    pattern: /\b(terminal|shell|bash|chat mode|terminal mode|switch between|mode tabs?)\b/i,
    targetIds: ['chat-mode', 'terminal-mode', 'chat-input'],
  },
];

export function buildGuidedTourPlan({
  request,
  targets = DEFAULT_TOUR_TARGETS,
}: BuildGuidedTourPlanInput): GuidedTourPlan {
  const recipe = TOUR_RECIPES.find((candidate) => candidate.pattern.test(request))
    ?? {
      id: 'getting-started',
      title: 'Getting Started',
      description: 'A quick orientation to the main Agent Browser controls.',
      targetIds: ['primary-navigation', 'omnibar', 'agent-provider', 'tools-picker', 'chat-input'],
    };
  const targetById = buildTargetMap(targets);
  const recipeTargets = recipe.targetIds
    .map((id) => targetById.get(id))
    .filter((target): target is TourTargetDescriptor => Boolean(target));
  const scoredTargets = targets
    .filter((target) => !recipe.targetIds.includes(target.id))
    .map((target) => ({ target, score: scoreTarget(request, target) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ target }) => target);
  const selected = uniqueTargets([...recipeTargets, ...scoredTargets]).slice(0, MAX_TOUR_STEPS);

  return sanitizeTourPlan({
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    steps: selected.map(targetToStep),
  }, targets);
}

export function sanitizeTourPlan(value: unknown, targets: readonly TourTargetDescriptor[] = DEFAULT_TOUR_TARGETS): GuidedTourPlan {
  const record = isRecord(value) ? value : {};
  const targetById = buildTargetMap(targets);
  const rawSteps = Array.isArray(record.steps) ? record.steps : [];
  const steps = rawSteps
    .map((step) => sanitizeStep(step, targetById))
    .filter((step): step is GuidedTourStep => Boolean(step))
    .slice(0, MAX_TOUR_STEPS);

  return {
    id: nonEmptyString(record.id) || 'guided-tour',
    title: nonEmptyString(record.title) || 'Guided Tour',
    description: nonEmptyString(record.description) || 'Follow the highlighted controls to learn this workflow.',
    steps,
  };
}

export function startDriverTour(plan: GuidedTourPlan, options: StartDriverTourOptions = {}): StartDriverTourResult {
  const root = options.root ?? (typeof document !== 'undefined' ? document : undefined);
  if (!root) {
    return {
      started: false,
      stepCount: 0,
      skippedTargetIds: plan.steps.map((step) => step.targetId),
      error: 'No document is available for Driver.js.',
    };
  }

  const skippedTargetIds: string[] = [];
  const visibleSteps: DriverStep[] = [];
  for (const step of plan.steps) {
    if (root.querySelector(step.element)) {
      visibleSteps.push({
        element: step.element,
        popover: step.popover,
      });
    } else {
      skippedTargetIds.push(step.targetId);
    }
  }

  const steps = visibleSteps.length > 0
    ? visibleSteps
    : [{
      popover: {
        title: 'Tour targets are not visible',
        description: `Open the relevant panel, then ask Tour Guide again for "${plan.title}".`,
      },
    }];
  const driverFactory = options.driverFactory ?? driver;
  const driverObj = driverFactory({
    showProgress: true,
    allowClose: true,
    stagePadding: 6,
    popoverClass: 'agent-browser-tour',
    steps,
  });
  driverObj.drive();

  return {
    started: true,
    stepCount: steps.length,
    skippedTargetIds,
  };
}

function targetToStep(target: TourTargetDescriptor): GuidedTourStep {
  return {
    targetId: target.id,
    element: target.selector,
    popover: {
      title: target.label,
      description: target.description,
      ...(target.side ? { side: target.side } : {}),
      ...(target.align ? { align: target.align } : {}),
    },
  };
}

function sanitizeStep(value: unknown, targetById: Map<string, TourTargetDescriptor>): GuidedTourStep | null {
  if (!isRecord(value)) return null;
  const targetId = nonEmptyString(value.targetId);
  const target = targetId ? targetById.get(targetId) : undefined;
  if (!target || value.element !== target.selector) return null;
  const popover = isRecord(value.popover) ? value.popover : {};
  return {
    targetId: target.id,
    element: target.selector,
    popover: {
      title: nonEmptyString(popover.title) || target.label,
      description: nonEmptyString(popover.description) || target.description,
      ...(target.side ? { side: target.side } : {}),
      ...(target.align ? { align: target.align } : {}),
    },
  };
}

function scoreTarget(request: string, target: TourTargetDescriptor): number {
  const text = request.toLowerCase();
  return target.keywords.reduce((score, keyword) => (
    text.includes(keyword.toLowerCase()) ? score + 1 : score
  ), 0);
}

function uniqueTargets(targets: TourTargetDescriptor[]): TourTargetDescriptor[] {
  const seen = new Set<string>();
  const unique: TourTargetDescriptor[] = [];
  for (const target of targets) {
    if (seen.has(target.id)) continue;
    seen.add(target.id);
    unique.push(target);
  }
  return unique;
}

function buildTargetMap(targets: readonly TourTargetDescriptor[]): Map<string, TourTargetDescriptor> {
  const targetById = new Map<string, TourTargetDescriptor>();
  for (const target of targets) {
    if (!targetById.has(target.id)) {
      targetById.set(target.id, target);
    }
  }
  return targetById;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
