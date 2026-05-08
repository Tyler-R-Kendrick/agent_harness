export interface HarnessEvolutionSettings {
  enabled: boolean;
  safeModeOnFailure: boolean;
  requireVisualValidation: boolean;
  sandboxRoot: string;
  patchPackageCommand: string;
  allowedPatchScopes: string[];
  validationCommands: string[];
}

export interface HarnessEvolutionFailure {
  message: string;
  componentId?: string;
  debugArtifactPaths?: string[];
}

export interface HarnessEvolutionRequest {
  componentId: string;
  changeSummary: string;
  touchesStyling?: boolean;
  failure?: HarnessEvolutionFailure;
}

export interface HarnessEvolutionPlan {
  enabled: boolean;
  componentId: string;
  sandboxId: string;
  sandboxPath: string;
  patchPackageCommand: string;
  validationCommands: string[];
  adoptionGate: string[];
  fallbackActions: string[];
  protectedScopes: string[];
  visualValidationRequired: boolean;
  summary: string;
}

export const DEFAULT_HARNESS_EVOLUTION_SETTINGS: HarnessEvolutionSettings = {
  enabled: true,
  safeModeOnFailure: true,
  requireVisualValidation: true,
  sandboxRoot: '.harness-evolution/sandboxes',
  patchPackageCommand: 'npx patch-package',
  allowedPatchScopes: [
    'agent-browser/src/features/harness-ui',
    'agent-browser/src/services',
    'agent-browser/src/App.tsx',
    'agent-browser/src/App.css',
  ],
  validationCommands: [
    'npm.cmd --workspace agent-browser run test:scripts',
    'npm.cmd --workspace agent-browser run lint',
    'npm.cmd run visual:agent-browser',
  ],
};

export function isHarnessEvolutionSettings(value: unknown): value is HarnessEvolutionSettings {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean'
    && typeof value.safeModeOnFailure === 'boolean'
    && typeof value.requireVisualValidation === 'boolean'
    && typeof value.sandboxRoot === 'string'
    && typeof value.patchPackageCommand === 'string'
    && isStringArray(value.allowedPatchScopes)
    && isStringArray(value.validationCommands)
  );
}

export function normalizeHarnessEvolutionSettings(
  settings: HarnessEvolutionSettings = DEFAULT_HARNESS_EVOLUTION_SETTINGS,
): HarnessEvolutionSettings {
  const sandboxRoot = settings.sandboxRoot.trim() || DEFAULT_HARNESS_EVOLUTION_SETTINGS.sandboxRoot;
  const patchPackageCommand = settings.patchPackageCommand.trim() || DEFAULT_HARNESS_EVOLUTION_SETTINGS.patchPackageCommand;
  const allowedPatchScopes = uniqueStrings(settings.allowedPatchScopes);
  const validationCommands = uniqueStrings(settings.validationCommands);
  return {
    enabled: settings.enabled,
    safeModeOnFailure: settings.safeModeOnFailure,
    requireVisualValidation: settings.requireVisualValidation,
    sandboxRoot,
    patchPackageCommand,
    allowedPatchScopes: allowedPatchScopes.length > 0
      ? allowedPatchScopes
      : [...DEFAULT_HARNESS_EVOLUTION_SETTINGS.allowedPatchScopes],
    validationCommands: validationCommands.length > 0
      ? validationCommands
      : [...DEFAULT_HARNESS_EVOLUTION_SETTINGS.validationCommands],
  };
}

export function buildHarnessEvolutionPlan({
  settings = DEFAULT_HARNESS_EVOLUTION_SETTINGS,
  request,
}: {
  settings?: HarnessEvolutionSettings;
  request: HarnessEvolutionRequest;
}): HarnessEvolutionPlan {
  const normalized = normalizeHarnessEvolutionSettings(settings);
  const componentId = request.componentId.trim() || 'harness-component';
  const sandboxId = stableSlug(componentId);
  const visualValidationRequired = normalized.requireVisualValidation || request.touchesStyling === true;
  const validationCommands = visualValidationRequired
    ? ensureIncludesVisualSmoke(normalized.validationCommands)
    : normalized.validationCommands;
  const fallbackActions = buildFallbackActions(normalized, request.failure);
  return {
    enabled: normalized.enabled,
    componentId,
    sandboxId,
    sandboxPath: `${normalized.sandboxRoot}/${sandboxId}`,
    patchPackageCommand: normalized.patchPackageCommand,
    validationCommands,
    adoptionGate: [
      'Develop the candidate patch inside the harness-evolution sandbox before touching the live app.',
      `Generate the final patch with ${normalized.patchPackageCommand} after the sandboxed component passes tests.`,
      'Adopt the patch only after every validation command passes on the live workspace.',
      visualValidationRequired
        ? 'Attach the visual smoke screenshot before handoff because this change may affect UI or styling.'
        : 'Record why visual validation is not required for this non-visual change.',
    ],
    fallbackActions,
    protectedScopes: [...normalized.allowedPatchScopes],
    visualValidationRequired,
    summary: `Plan ${componentId} in ${normalized.sandboxRoot}/${sandboxId}: ${request.changeSummary.trim() || 'Harness evolution request'}`,
  };
}

export function buildHarnessEvolutionPromptContext(plan: HarnessEvolutionPlan): string {
  if (!plan.enabled) return '';
  return [
    '## Harness Evolution',
    `Target component: ${plan.componentId}`,
    `Sandbox path: ${plan.sandboxPath}`,
    `Patch command: ${plan.patchPackageCommand}`,
    `Visual validation required: ${plan.visualValidationRequired ? 'yes' : 'no'}`,
    `Protected patch scopes: ${plan.protectedScopes.join(', ')}`,
    'Validation commands:',
    ...plan.validationCommands.map((command) => `- ${command}`),
    'Adoption gates:',
    ...plan.adoptionGate.map((gate) => `- ${gate}`),
    'Fallback actions:',
    ...plan.fallbackActions.map((action) => `- ${action}`),
    'Instruction: evolve harness components in a sandbox, keep patches scoped, validate before adoption, and fall back to safe mode when a patched component fails.',
  ].join('\n');
}

function buildFallbackActions(
  settings: HarnessEvolutionSettings,
  failure?: HarnessEvolutionFailure,
): string[] {
  if (!settings.safeModeOnFailure) {
    return ['Safe mode fallback is disabled; preserve the failing patch evidence and block adoption.'];
  }
  const actions = [
    'Switch the affected component to safe mode and render the original unpatched code path.',
    'Preserve the failed patch, validation output, console errors, and visual artifacts for the next sandbox iteration.',
  ];
  if (failure?.message) {
    actions.push(`Seed the next sandbox iteration with failure: ${failure.message}`);
  }
  if (failure?.componentId) {
    actions.push(`Treat ${failure.componentId} as the failed component boundary.`);
  }
  if (failure?.debugArtifactPaths?.length) {
    actions.push(`Attach debug artifacts: ${uniqueStrings(failure.debugArtifactPaths).join(', ')}`);
  }
  return actions;
}

function ensureIncludesVisualSmoke(commands: string[]): string[] {
  return commands.some((command) => command.includes('visual:agent-browser'))
    ? commands
    : [...commands, 'npm.cmd run visual:agent-browser'];
}

function uniqueStrings(values: readonly string[]): string[] {
  return values.map((value) => value.trim()).filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);
}

function stableSlug(value: string): string {
  const words = value.replace(/([a-z0-9])([A-Z])/g, '$1-$2');
  const slug = words
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || 'harness-component';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
