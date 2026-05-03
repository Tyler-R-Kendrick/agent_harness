import { describe, expect, it } from 'vitest';
import { createDefaultHarnessAppSpec } from './harnessSpec';
import { regenerateHarnessAppSpec, restoreDefaultHarnessAppSpec } from './harnessRegeneration';

describe('harness regeneration', () => {
  it('patches known app chrome from natural language while preserving the design system', () => {
    const spec = createDefaultHarnessAppSpec({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
    });

    const result = regenerateHarnessAppSpec({
      spec,
      prompt: 'Make the workspace sidebar compact and rename the assistant dock to Copilot dock.',
      workspaceId: 'ws-research',
      workspaceName: 'Research',
    });

    expect(result.summary).toMatch(/sidebar/i);
    expect(result.spec.elements['workspace-sidebar'].props).toMatchObject({ density: 'compact' });
    expect(result.spec.elements['assistant-dock'].props).toMatchObject({ title: 'Copilot dock' });
    expect(result.spec.metadata.designSystemId).toBe('agent-browser/current');
    expect(result.spec.metadata.revision).toBe(2);
    expect(JSON.stringify(result.spec)).not.toContain('freeform-css');
  });

  it('adds generated session dashboard widgets as catalog elements instead of arbitrary code', () => {
    const spec = createDefaultHarnessAppSpec({
      workspaceId: 'ws-build',
      workspaceName: 'Build',
    });

    const result = regenerateHarnessAppSpec({
      spec,
      prompt: 'Add a session summary widget to the dashboard.',
      workspaceId: 'ws-build',
      workspaceName: 'Build',
    });
    const dashboardChildren = result.spec.elements['main-dashboard'].children ?? [];
    const generatedId = dashboardChildren.find((id) => id.startsWith('generated-session-summary-widget-'));

    expect(generatedId).toBeTruthy();
    expect(result.spec.elements[generatedId!]).toMatchObject({
      type: 'SessionConversationSummary',
      slot: 'dashboard.canvas',
      props: expect.objectContaining({ title: 'Session summary', sessionId: 'active' }),
    });
    expect(result.spec.metadata.revision).toBe(2);
  });

  it('restores defaults for the current workspace without leaking generated widgets', () => {
    const spec = createDefaultHarnessAppSpec({
      workspaceId: 'ws-build',
      workspaceName: 'Build',
    });
    const generated = regenerateHarnessAppSpec({
      spec,
      prompt: 'Add a session summary widget.',
      workspaceId: 'ws-build',
      workspaceName: 'Build',
    }).spec;

    const restored = restoreDefaultHarnessAppSpec({
      spec: generated,
      workspaceId: 'ws-build',
      workspaceName: 'Build',
    });

    expect(Object.keys(restored.spec.elements).some((id) => id.startsWith('generated-'))).toBe(false);
    expect(restored.spec.elements['main-dashboard'].props?.title).toBe('Build harness');
    expect(restored.spec.metadata.revision).toBe(3);
  });
});
