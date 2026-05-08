export type SpecFormat =
  | 'json-schema'
  | 'openapi'
  | 'asyncapi'
  | 'problem-details'
  | 'mermaid'
  | 'markdown-contract';

export type SpecLifecycleStage =
  | 'research'
  | 'draft-spec'
  | 'resolve-ambiguities'
  | 'write-tests'
  | 'red-green'
  | 'feedback-revision';

export interface SpecDrivenDevelopmentSettings {
  enabled: boolean;
  defaultFormat: SpecFormat;
  resolveAmbiguitiesBeforeImplementation: boolean;
  requireEvalCoverage: boolean;
}

export interface SpecWorkflowPlan {
  enabled: boolean;
  format: SpecFormat;
  formatLabel: string;
  stage: SpecLifecycleStage;
  ambiguities: string[];
  validationGates: string[];
  instructions: string[];
}

export interface SpecWorkflowFeedback {
  specId: string;
  feedback: string;
  outputSummary: string;
}

export const SPEC_FORMAT_LABELS: Record<SpecFormat, string> = {
  'json-schema': 'JSON Schema 2020-12',
  openapi: 'OpenAPI 3.1',
  asyncapi: 'AsyncAPI 3.1',
  'problem-details': 'RFC 9457 Problem Details',
  mermaid: 'Mermaid diagram',
  'markdown-contract': 'Markdown contract',
};

export const DEFAULT_SPEC_DRIVEN_DEVELOPMENT_SETTINGS: SpecDrivenDevelopmentSettings = {
  enabled: true,
  defaultFormat: 'json-schema',
  resolveAmbiguitiesBeforeImplementation: true,
  requireEvalCoverage: true,
};

const SPEC_FORMATS: SpecFormat[] = [
  'json-schema',
  'openapi',
  'asyncapi',
  'problem-details',
  'mermaid',
  'markdown-contract',
];

export function isSpecDrivenDevelopmentSettings(value: unknown): value is SpecDrivenDevelopmentSettings {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean'
    && typeof value.defaultFormat === 'string'
    && (SPEC_FORMATS as string[]).includes(value.defaultFormat)
    && typeof value.resolveAmbiguitiesBeforeImplementation === 'boolean'
    && typeof value.requireEvalCoverage === 'boolean'
  );
}

export function createSpecWorkflowPlan({
  task,
  settings = DEFAULT_SPEC_DRIVEN_DEVELOPMENT_SETTINGS,
}: {
  task: string;
  settings?: SpecDrivenDevelopmentSettings;
}): SpecWorkflowPlan {
  const normalizedSettings = cloneSettings(settings);
  const format = inferSpecFormat(task, normalizedSettings.defaultFormat);
  const ambiguities = inferAmbiguities(task);
  const validationGates = buildValidationGates(normalizedSettings);
  const stage = selectLifecycleStage({ task, ambiguities, settings: normalizedSettings });
  return {
    enabled: normalizedSettings.enabled,
    format,
    formatLabel: SPEC_FORMAT_LABELS[format],
    stage,
    ambiguities,
    validationGates,
    instructions: buildInstructions({ format, stage, settings: normalizedSettings }),
  };
}

export function buildSpecDrivenDevelopmentPromptContext(plan: SpecWorkflowPlan): string {
  if (!plan.enabled) return '';
  return [
    '## Spec-Driven Development',
    `Lifecycle stage: ${plan.stage}`,
    `Spec format: ${plan.formatLabel}`,
    'Write or update the spec before implementation.',
    plan.ambiguities.length
      ? `Ambiguities to resolve: ${plan.ambiguities.join(' ')}`
      : 'Ambiguities to resolve: none detected; state assumptions explicitly in the spec.',
    `Validation gates: ${plan.validationGates.join(' ')}`,
    `Instructions: ${plan.instructions.join(' ')}`,
    'Use red/green development: write failing tests or evals from the spec, make them pass, then revise the spec when user feedback identifies output-quality gaps.',
  ].join('\n');
}

export function buildSpecFeedbackRevisionPrompt(feedback: SpecWorkflowFeedback): string {
  return [
    `Spec feedback for ${feedback.specId}: ${feedback.feedback.trim()}`,
    `Observed output: ${feedback.outputSummary.trim()}`,
    'Revise the spec before changing implementation.',
    'Identify the ambiguous or missing contract clause, update the validation gates, then continue with red/green implementation.',
  ].join('\n');
}

function inferSpecFormat(task: string, fallback: SpecFormat): SpecFormat {
  const text = task.toLowerCase();
  if (/\b(openapi|rest|http api|endpoint|route|controller|webhook)\b/.test(text)) return 'openapi';
  if (/\b(asyncapi|kafka|pubsub|pub-sub|event|message bus|topic|queue|stream)\b/.test(text)) return 'asyncapi';
  if (/\b(problem details|rfc 9457|error response|validation error|422|400 response)\b/.test(text)) return 'problem-details';
  if (/\b(mermaid|diagram|state machine|sequence|flowchart|graph)\b/.test(text)) return 'mermaid';
  if (/\b(markdown contract|prd|requirements doc|acceptance criteria doc)\b/.test(text)) return 'markdown-contract';
  if (/\b(schema|structured|json|extract|payload|contract|output)\b/.test(text)) return 'json-schema';
  return fallback;
}

function inferAmbiguities(task: string): string[] {
  const text = task.toLowerCase();
  const ambiguities: string[] = [];
  if (/\b(good|better|nice|polished|improve|enhance|state-of-the-art)\b/.test(text)) {
    ambiguities.push('Define measurable acceptance criteria.');
  }
  if (!/\b(example|sample|fixture|input|output|payload|screenshot)\b/.test(text)) {
    ambiguities.push('Provide at least one concrete input/output example.');
  }
  if (!/\b(test|eval|validation|assert|coverage|metric)\b/.test(text)) {
    ambiguities.push('Name the validation evidence that proves the spec is satisfied.');
  }
  return uniqueStrings(ambiguities);
}

function buildValidationGates(settings: SpecDrivenDevelopmentSettings): string[] {
  const gates = ['Write tests or evals that validate the spec before implementation.'];
  if (settings.resolveAmbiguitiesBeforeImplementation) {
    gates.push('Resolve or explicitly record ambiguities before production code changes.');
  }
  if (settings.requireEvalCoverage) {
    gates.push('Keep spec-derived validation coverage current through each red/green cycle.');
  }
  return gates;
}

function selectLifecycleStage({
  task,
  ambiguities,
  settings,
}: {
  task: string;
  ambiguities: readonly string[];
  settings: SpecDrivenDevelopmentSettings;
}): SpecLifecycleStage {
  if (!settings.enabled) return 'draft-spec';
  const text = task.toLowerCase();
  if (/\b(feedback|revise|iteration|quality)\b/.test(text)) return 'feedback-revision';
  if (settings.resolveAmbiguitiesBeforeImplementation && ambiguities.length > 0) return 'resolve-ambiguities';
  if (/\b(test|eval|validation|assert|coverage)\b/.test(text)) return 'write-tests';
  if (/\b(implement|code|fix|red green|red\/green)\b/.test(text)) return 'red-green';
  if (/\b(research|standard|specification|format)\b/.test(text)) return 'research';
  return 'draft-spec';
}

function buildInstructions({
  format,
  stage,
  settings,
}: {
  format: SpecFormat;
  stage: SpecLifecycleStage;
  settings: SpecDrivenDevelopmentSettings;
}): string[] {
  return [
    `Draft the ${SPEC_FORMAT_LABELS[format]} contract first.`,
    stage === 'resolve-ambiguities'
      ? 'Ask concise clarifying questions or document assumptions before implementation.'
      : 'Keep the current spec synchronized with implementation decisions.',
    settings.requireEvalCoverage
      ? 'Derive tests or evals from spec clauses before changing product behavior.'
      : 'Prefer spec-derived tests when the behavior has user-visible risk.',
  ];
}

function cloneSettings(settings: SpecDrivenDevelopmentSettings): SpecDrivenDevelopmentSettings {
  return { ...settings };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
