import { describe, expect, it } from 'vitest';

import {
  buildOptimizationPlan,
  classifySectionDestination,
  resolveCanonicalSkillRoot,
} from './resolve-optimization-plan';

describe('resolveCanonicalSkillRoot', () => {
  it('preserves canonical skills paths', () => {
    expect(resolveCanonicalSkillRoot('skills/release-manager')).toMatchObject({
      skillRoot: 'skills/release-manager',
      skillFile: 'skills/release-manager/SKILL.md',
      scriptsDir: 'skills/release-manager/scripts',
      fromCompatibilityLink: false,
    });
  });

  it('rewrites compatibility links to canonical skills paths', () => {
    expect(resolveCanonicalSkillRoot('.agents/skills/pdf-cleanup')).toMatchObject({
      skillRoot: 'skills/pdf-cleanup',
      skillFile: 'skills/pdf-cleanup/SKILL.md',
      referencesDir: 'skills/pdf-cleanup/references',
      fromCompatibilityLink: true,
    });
  });
});

describe('classifySectionDestination', () => {
  it('keeps workflow guidance in the main skill file', () => {
    expect(classifySectionDestination('Workflow', 'Keep this short and triggerable.')).toBe('skill');
  });

  it('moves schemas and examples into references', () => {
    expect(classifySectionDestination('JSON Schema', '```json\n{"type":"object"}\n```')).toBe('reference');
    expect(classifySectionDestination('Examples', 'Long example bank')).toBe('reference');
  });
});

describe('buildOptimizationPlan', () => {
  it('includes deterministic output paths in the plan', () => {
    const plan = buildOptimizationPlan('.agents/skills/pdf-cleanup');

    expect(plan.paths.scriptsDir).toBe('skills/pdf-cleanup/scripts');
    expect(plan.steps).toContain('Write deterministic helpers under skills/pdf-cleanup/scripts');
    expect(plan.steps).toContain('Create or refresh skills/pdf-cleanup/evals/evals.json');
  });
});