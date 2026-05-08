import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HARNESS_EVOLUTION_SETTINGS,
  buildHarnessEvolutionPlan,
  buildHarnessEvolutionPromptContext,
  isHarnessEvolutionSettings,
  normalizeHarnessEvolutionSettings,
} from './harnessEvolution';

describe('harnessEvolution', () => {
  it('validates and normalizes persisted settings', () => {
    expect(isHarnessEvolutionSettings(DEFAULT_HARNESS_EVOLUTION_SETTINGS)).toBe(true);
    expect(isHarnessEvolutionSettings({ enabled: true })).toBe(false);

    const normalized = normalizeHarnessEvolutionSettings({
      ...DEFAULT_HARNESS_EVOLUTION_SETTINGS,
      sandboxRoot: '  ',
      patchPackageCommand: '',
      allowedPatchScopes: ['agent-browser/src/App.tsx', 'agent-browser/src/App.tsx', '  '],
      validationCommands: [' npm.cmd run visual:agent-browser ', 'npm.cmd run visual:agent-browser'],
    });

    expect(normalized.sandboxRoot).toBe(DEFAULT_HARNESS_EVOLUTION_SETTINGS.sandboxRoot);
    expect(normalized.patchPackageCommand).toBe(DEFAULT_HARNESS_EVOLUTION_SETTINGS.patchPackageCommand);
    expect(normalized.allowedPatchScopes).toEqual(['agent-browser/src/App.tsx']);
    expect(normalized.validationCommands).toEqual(['npm.cmd run visual:agent-browser']);
  });

  it('builds a sandboxed patch plan with safe-mode fallback and visual gates', () => {
    const plan = buildHarnessEvolutionPlan({
      settings: DEFAULT_HARNESS_EVOLUTION_SETTINGS,
      request: {
        componentId: 'HarnessDashboardPanel',
        changeSummary: 'Allow users to add a visual dashboard widget',
        touchesStyling: true,
        failure: {
          message: 'Rendered widget crashed on mount',
          componentId: 'HarnessDashboardPanel',
          debugArtifactPaths: ['output/playwright/agent-browser-visual-smoke.png'],
        },
      },
    });

    expect(plan.sandboxId).toBe('harness-dashboard-panel');
    expect(plan.visualValidationRequired).toBe(true);
    expect(plan.validationCommands).toContain('npm.cmd run visual:agent-browser');
    expect(plan.fallbackActions.join(' ')).toContain('safe mode');
    expect(plan.fallbackActions.join(' ')).toContain('Rendered widget crashed on mount');
    expect(plan.summary).toContain('HarnessDashboardPanel');
  });

  it('renders prompt context only when enabled', () => {
    const disabledPlan = buildHarnessEvolutionPlan({
      settings: { ...DEFAULT_HARNESS_EVOLUTION_SETTINGS, enabled: false },
      request: { componentId: 'HarnessDashboardPanel', changeSummary: 'Try a patch' },
    });
    expect(buildHarnessEvolutionPromptContext(disabledPlan)).toBe('');

    const enabledPlan = buildHarnessEvolutionPlan({
      settings: DEFAULT_HARNESS_EVOLUTION_SETTINGS,
      request: { componentId: 'HarnessDashboardPanel', changeSummary: 'Try a patch' },
    });
    expect(buildHarnessEvolutionPromptContext(enabledPlan)).toContain('## Harness Evolution');
    expect(buildHarnessEvolutionPromptContext(enabledPlan)).toContain('npx patch-package');
    expect(buildHarnessEvolutionPromptContext(enabledPlan)).toContain('agent-browser/src/features/harness-ui');
  });
});
