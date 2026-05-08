import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPEC_DRIVEN_DEVELOPMENT_SETTINGS,
  buildSpecDrivenDevelopmentPromptContext,
  buildSpecFeedbackRevisionPrompt,
  createSpecWorkflowPlan,
  isSpecDrivenDevelopmentSettings,
} from './specDrivenDevelopment';

describe('specDrivenDevelopment', () => {
  it('validates persisted settings and rejects malformed values', () => {
    expect(isSpecDrivenDevelopmentSettings(DEFAULT_SPEC_DRIVEN_DEVELOPMENT_SETTINGS)).toBe(true);
    expect(isSpecDrivenDevelopmentSettings({ enabled: true })).toBe(false);
    expect(isSpecDrivenDevelopmentSettings({
      ...DEFAULT_SPEC_DRIVEN_DEVELOPMENT_SETTINGS,
      defaultFormat: 'spreadsheet',
    })).toBe(false);
  });

  it('selects domain standard spec formats from task text', () => {
    expect(createSpecWorkflowPlan({ task: 'Add REST endpoints for projects' }).format).toBe('openapi');
    expect(createSpecWorkflowPlan({ task: 'Design Kafka topic events for updates' }).format).toBe('asyncapi');
    expect(createSpecWorkflowPlan({ task: 'Standardize 422 validation errors' }).format).toBe('problem-details');
    expect(createSpecWorkflowPlan({ task: 'Draw the checkout state machine' }).format).toBe('mermaid');
    expect(createSpecWorkflowPlan({ task: 'Return structured extraction results' }).format).toBe('json-schema');
  });

  it('plans ambiguity resolution and validation gates before implementation', () => {
    const plan = createSpecWorkflowPlan({ task: 'Build a good dashboard' });

    expect(plan.stage).toBe('resolve-ambiguities');
    expect(plan.ambiguities).toContain('Define measurable acceptance criteria.');
    expect(plan.ambiguities).toContain('Provide at least one concrete input/output example.');
    expect(plan.validationGates).toContain('Write tests or evals that validate the spec before implementation.');
  });

  it('builds prompt context for spec-first red green implementation', () => {
    const context = buildSpecDrivenDevelopmentPromptContext(createSpecWorkflowPlan({
      task: 'Add an HTTP API with validation errors',
    }));

    expect(context).toContain('## Spec-Driven Development');
    expect(context).toContain('Write or update the spec before implementation.');
    expect(context).toContain('OpenAPI 3.1');
    expect(context).toContain('red/green');
  });

  it('omits prompt context when the workflow is disabled', () => {
    const context = buildSpecDrivenDevelopmentPromptContext(createSpecWorkflowPlan({
      task: 'Add an HTTP API',
      settings: { ...DEFAULT_SPEC_DRIVEN_DEVELOPMENT_SETTINGS, enabled: false },
    }));

    expect(context).toBe('');
  });

  it('turns user output feedback into a spec revision prompt', () => {
    const prompt = buildSpecFeedbackRevisionPrompt({
      specId: 'spec:dashboard',
      feedback: 'The empty state is unclear.',
      outputSummary: 'Dashboard cards render without an empty state contract.',
    });

    expect(prompt).toContain('spec:dashboard');
    expect(prompt).toContain('The empty state is unclear.');
    expect(prompt).toContain('Revise the spec before changing implementation.');
  });
});
