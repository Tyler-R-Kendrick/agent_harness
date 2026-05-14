export type AiPointerTargetKind =
  | 'screen-region'
  | 'text'
  | 'paragraph'
  | 'image'
  | 'table'
  | 'product'
  | 'place'
  | 'recipe'
  | 'object';

export type AiPointerEntity = {
  type: string;
  label: string;
};

export type AiPointerReference = {
  label: string;
  kind: AiPointerTargetKind | string;
  text?: string;
};

export type AiPointerTabContext = {
  id: string;
  title: string;
  url: string;
};

export type AiPointerCoordinates = {
  x: number;
  y: number;
  xPercent: number;
  yPercent: number;
};

export type AiPointerTarget = {
  id: string;
  tab: AiPointerTabContext;
  targetKind: AiPointerTargetKind;
  coordinates: AiPointerCoordinates;
  semanticLabel?: string;
  selectedText?: string;
  entities: AiPointerEntity[];
  references: AiPointerReference[];
  capturedAt: string;
};

export type AiPointerActionId =
  | 'explain-this'
  | 'summarize-selection'
  | 'compare-selected'
  | 'rewrite-this'
  | 'chart-table'
  | 'edit-image'
  | 'find-places'
  | 'visualize-here'
  | 'double-recipe'
  | 'move-this'
  | 'merge-those'
  | 'add-that';

export type AiPointerAction = {
  id: AiPointerActionId;
  label: string;
  prompt: string;
  targetKinds: AiPointerTargetKind[];
  entityTypes: string[];
};

export type AiPointerSettings = {
  enabled: boolean;
  captureMode: 'point-and-ask';
  includePageProvenance: boolean;
  includeEntityHints: boolean;
  requireConfirmation: boolean;
  quickActions: AiPointerActionId[];
};

export type AiPointerFeatureState = {
  settings: AiPointerSettings;
  lastTarget?: AiPointerTarget | null;
};

export const AI_POINTER_ACTIONS: Record<AiPointerActionId, AiPointerAction> = {
  'explain-this': {
    id: 'explain-this',
    label: 'Explain this',
    prompt: 'Explain the pointed target using only visible or cited page context.',
    targetKinds: ['screen-region', 'text', 'paragraph', 'image', 'table', 'product', 'place', 'recipe', 'object'],
    entityTypes: [],
  },
  'summarize-selection': {
    id: 'summarize-selection',
    label: 'Summarize selection',
    prompt: 'Summarize the selected or pointed content.',
    targetKinds: ['text', 'paragraph', 'table', 'product', 'place', 'recipe', 'object', 'screen-region'],
    entityTypes: [],
  },
  'compare-selected': {
    id: 'compare-selected',
    label: 'Compare selected things',
    prompt: 'Compare the pointed target with the selected references.',
    targetKinds: ['product', 'place', 'image', 'object', 'screen-region'],
    entityTypes: [],
  },
  'rewrite-this': {
    id: 'rewrite-this',
    label: 'Rewrite this',
    prompt: 'Rewrite the selected text while preserving intent.',
    targetKinds: ['text', 'paragraph', 'screen-region'],
    entityTypes: [],
  },
  'chart-table': {
    id: 'chart-table',
    label: 'Chart table',
    prompt: 'Turn the pointed table or numeric content into an appropriate chart.',
    targetKinds: ['table', 'screen-region'],
    entityTypes: [],
  },
  'edit-image': {
    id: 'edit-image',
    label: 'Edit image',
    prompt: 'Edit the pointed image or region according to the command.',
    targetKinds: ['image', 'screen-region'],
    entityTypes: [],
  },
  'find-places': {
    id: 'find-places',
    label: 'Find places',
    prompt: 'Find map, route, or place details for the pointed location entity.',
    targetKinds: ['place', 'text', 'paragraph', 'screen-region'],
    entityTypes: ['place', 'address', 'location', 'map'],
  },
  'visualize-here': {
    id: 'visualize-here',
    label: 'Visualize here',
    prompt: 'Generate or preview the requested visual change in the pointed region.',
    targetKinds: ['image', 'object', 'screen-region'],
    entityTypes: [],
  },
  'double-recipe': {
    id: 'double-recipe',
    label: 'Double recipe',
    prompt: 'Scale the pointed recipe quantities and timing.',
    targetKinds: ['recipe', 'text', 'paragraph', 'screen-region'],
    entityTypes: ['recipe', 'ingredient', 'quantity'],
  },
  'move-this': {
    id: 'move-this',
    label: 'Move this',
    prompt: 'Move the pointed object according to the command.',
    targetKinds: ['object', 'screen-region'],
    entityTypes: [],
  },
  'merge-those': {
    id: 'merge-those',
    label: 'Merge those',
    prompt: 'Merge the selected objects or ideas.',
    targetKinds: ['object', 'screen-region'],
    entityTypes: [],
  },
  'add-that': {
    id: 'add-that',
    label: 'Add that',
    prompt: 'Add the referenced item at the pointed location.',
    targetKinds: ['object', 'image', 'screen-region'],
    entityTypes: [],
  },
};

export const DEFAULT_AI_POINTER_SETTINGS: AiPointerSettings = {
  enabled: true,
  captureMode: 'point-and-ask',
  includePageProvenance: true,
  includeEntityHints: true,
  requireConfirmation: true,
  quickActions: Object.keys(AI_POINTER_ACTIONS) as AiPointerActionId[],
};

const TARGET_KINDS: AiPointerTargetKind[] = [
  'screen-region',
  'text',
  'paragraph',
  'image',
  'table',
  'product',
  'place',
  'recipe',
  'object',
];

const ACTION_IDS = Object.keys(AI_POINTER_ACTIONS) as AiPointerActionId[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isAiPointerTargetKind(value: unknown): value is AiPointerTargetKind {
  return typeof value === 'string' && (TARGET_KINDS as string[]).includes(value);
}

function isAiPointerActionId(value: unknown): value is AiPointerActionId {
  return typeof value === 'string' && (ACTION_IDS as string[]).includes(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeViewportDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function normalizePoint(value: number, max: number): number {
  return roundOneDecimal(clamp(value, 0, max));
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isAiPointerEntity(value: unknown): value is AiPointerEntity {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.type) && isNonEmptyString(value.label);
}

function isAiPointerReference(value: unknown): value is AiPointerReference {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.label) && isNonEmptyString(value.kind) && isOptionalString(value.text);
}

function isAiPointerCoordinates(value: unknown): value is AiPointerCoordinates {
  if (!isRecord(value)) return false;
  return (
    isFiniteNumber(value.x)
    && isFiniteNumber(value.y)
    && isFiniteNumber(value.xPercent)
    && value.xPercent >= 0
    && value.xPercent <= 100
    && isFiniteNumber(value.yPercent)
    && value.yPercent >= 0
    && value.yPercent <= 100
  );
}

function isAiPointerTabContext(value: unknown): value is AiPointerTabContext {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id) && isNonEmptyString(value.title) && isOptionalString(value.url);
}

export function isAiPointerTarget(value: unknown): value is AiPointerTarget {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id)
    && isAiPointerTabContext(value.tab)
    && isAiPointerTargetKind(value.targetKind)
    && isAiPointerCoordinates(value.coordinates)
    && isOptionalString(value.semanticLabel)
    && isOptionalString(value.selectedText)
    && Array.isArray(value.entities)
    && value.entities.every(isAiPointerEntity)
    && Array.isArray(value.references)
    && value.references.every(isAiPointerReference)
    && isNonEmptyString(value.capturedAt)
    && !Number.isNaN(Date.parse(value.capturedAt))
  );
}

export function isAiPointerSettings(value: unknown): value is AiPointerSettings {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean'
    && value.captureMode === 'point-and-ask'
    && typeof value.includePageProvenance === 'boolean'
    && typeof value.includeEntityHints === 'boolean'
    && typeof value.requireConfirmation === 'boolean'
    && Array.isArray(value.quickActions)
    && value.quickActions.every(isAiPointerActionId)
  );
}

export function isAiPointerFeatureState(value: unknown): value is AiPointerFeatureState {
  if (!isRecord(value) || !isAiPointerSettings(value.settings)) return false;
  return value.lastTarget === undefined || value.lastTarget === null || isAiPointerTarget(value.lastTarget);
}

export function captureAiPointerTarget(input: {
  tab: AiPointerTabContext;
  viewport: { width: number; height: number };
  point: { x: number; y: number };
  targetKind?: AiPointerTargetKind;
  semanticLabel?: string;
  selectedText?: string;
  entities?: AiPointerEntity[];
  references?: AiPointerReference[];
  now?: Date;
}): AiPointerTarget {
  const width = normalizeViewportDimension(input.viewport.width);
  const height = normalizeViewportDimension(input.viewport.height);
  const x = normalizePoint(input.point.x, width);
  const y = normalizePoint(input.point.y, height);
  const capturedAt = (input.now ?? new Date()).toISOString();

  return {
    id: `ai-pointer:${input.tab.id}:${capturedAt}`,
    tab: input.tab,
    targetKind: input.targetKind ?? 'screen-region',
    coordinates: {
      x,
      y,
      xPercent: roundOneDecimal((x / width) * 100),
      yPercent: roundOneDecimal((y / height) * 100),
    },
    semanticLabel: normalizeOptionalString(input.semanticLabel),
    selectedText: normalizeOptionalString(input.selectedText),
    entities: (input.entities ?? []).filter(isAiPointerEntity),
    references: (input.references ?? []).filter(isAiPointerReference),
    capturedAt,
  };
}

function hasEntityType(target: AiPointerTarget, types: string[]): boolean {
  const wanted = new Set(types.map((type) => type.toLowerCase()));
  return target.entities.some((entity) => wanted.has(entity.type.toLowerCase()));
}

function matchesTargetKind(action: AiPointerAction, target: AiPointerTarget): boolean {
  return action.targetKinds.includes(target.targetKind);
}

function shouldSuggestAction(action: AiPointerAction, target: AiPointerTarget): boolean {
  if (action.id === 'explain-this') return true;
  if (action.id === 'summarize-selection') return Boolean(target.selectedText) || target.targetKind !== 'image';
  if (action.id === 'compare-selected') return target.references.length > 1 || target.targetKind === 'product';
  if (action.id === 'rewrite-this') return Boolean(target.selectedText) && matchesTargetKind(action, target);
  if (action.id === 'find-places') return target.targetKind === 'place' || hasEntityType(target, action.entityTypes);
  if (action.id === 'double-recipe') return target.targetKind === 'recipe' || hasEntityType(target, action.entityTypes);
  if (action.id === 'move-this' || action.id === 'merge-those' || action.id === 'add-that') {
    return target.targetKind === 'object' || target.tab.url.startsWith('agent-browser://');
  }
  return matchesTargetKind(action, target);
}

export function suggestAiPointerActions(
  target: AiPointerTarget,
  settings: AiPointerSettings = DEFAULT_AI_POINTER_SETTINGS,
): AiPointerAction[] {
  const allowed = new Set(settings.quickActions);
  return ACTION_IDS
    .map((id) => AI_POINTER_ACTIONS[id])
    .filter((action) => settings.enabled && allowed.has(action.id) && shouldSuggestAction(action, target));
}

function formatEntityHints(target: AiPointerTarget): string | null {
  if (target.entities.length === 0) return null;
  return `Entity hints: ${target.entities.map((entity) => `${entity.type}: ${entity.label}`).join('; ')}`;
}

function formatReference(reference: AiPointerReference, index: number): string {
  return [
    `Reference ${index + 1}: ${reference.label} (${reference.kind})`,
    reference.text ? ` - ${reference.text}` : '',
  ].join('');
}

export function buildAiPointerPromptContext(
  target: AiPointerTarget,
  settings: AiPointerSettings = DEFAULT_AI_POINTER_SETTINGS,
): string {
  const lines = [
    'AI Pointer context:',
    settings.includePageProvenance ? `- Page: ${target.tab.title} (${target.tab.url})` : null,
    `- Target: ${target.targetKind}${target.semanticLabel ? ` - ${target.semanticLabel}` : ''}`,
    `- Point: ${target.coordinates.xPercent}% from left, ${target.coordinates.yPercent}% from top`,
    target.selectedText ? `- Selected text: ${target.selectedText}` : null,
    settings.includeEntityHints && formatEntityHints(target) ? `- ${formatEntityHints(target)}` : null,
    target.references.length ? '- Selected references:' : null,
    ...target.references.map((reference, index) => `  - ${formatReference(reference, index)}`),
    `- Captured: ${target.capturedAt}`,
  ];
  return lines.filter((line): line is string => Boolean(line)).join('\n');
}

export function buildAiPointerPrompt({
  actionId,
  command,
  target,
  settings = DEFAULT_AI_POINTER_SETTINGS,
}: {
  actionId: AiPointerActionId;
  command: string;
  target: AiPointerTarget;
  settings?: AiPointerSettings;
}): string {
  const action = AI_POINTER_ACTIONS[actionId];
  const confirmation = settings.requireConfirmation
    ? 'Keep the user in flow and ask for confirmation before changing external state.'
    : 'Keep the user in flow and proceed when the requested action is reversible.';

  return [
    'AI Pointer request',
    '',
    buildAiPointerPromptContext(target, settings),
    '',
    `Action: ${action.label}`,
    `Action guidance: ${action.prompt}`,
    `User command: ${command.trim() || action.prompt}`,
    '',
    'Reference rule: this/that/these/those refer to the pointed target and references above.',
    confirmation,
  ].join('\n');
}
