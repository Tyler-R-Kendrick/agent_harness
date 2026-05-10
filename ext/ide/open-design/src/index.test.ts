import { createHarnessExtensionContext } from 'harness-core';
import { describe, expect, it } from 'vitest';
import {
  OPEN_DESIGN_DIRECTIONS,
  OpenDesignStudio,
  approveOpenDesignTokenRevision,
  buildOpenDesignWorkspaceBundle,
  compileOpenDesignMd,
  createOpenDesignApprovalComposition,
  createOpenDesignExportArtifact,
  createOpenDesignPlugin,
  createOpenDesignStudioState,
  getOpenDesignApprovalSummary,
  getOpenDesignResearchInventory,
  publishOpenDesignSystem,
  requestOpenDesignTokenRevision,
  runOpenDesignCritique,
  selectOpenDesignDirection,
  updateOpenDesignBrief,
} from './index';

describe('OpenDesign studio model', () => {
  it('captures research, directions, and a design brief into DESIGN.md', () => {
    const state = selectOpenDesignDirection(
      updateOpenDesignBrief(createOpenDesignStudioState({ workspaceName: 'Research' }), {
        projectName: 'Agent Browser Studio',
        audience: 'Design engineers',
        surface: 'IDE extension pane',
        prompt: 'Build a minimal AI-native design studio.',
        githubUrl: 'https://github.com/example/agent-harness',
        localFolder: 'agent-browser',
        assets: 'logo.svg',
        notes: 'No badges, pills, or card-heavy UI.',
      }),
      'tech-utility',
    );

    const document = compileOpenDesignMd(state, '2026-05-09T12:00:00.000Z');

    expect(OPEN_DESIGN_DIRECTIONS.map((direction) => direction.id)).toContain('tech-utility');
    expect(document).toContain('name: Agent Browser Studio');
    expect(document).toContain('colors:');
    expect(document).toContain('styles:');
    expect(document).toContain('## Source Inventory');
    expect(document).toContain('## Token Review And Approval');
    expect(document).toContain('Status: reviewing. 0/6 token sections approved.');
    expect(document).toContain('Visual sample: Display hierarchy');
    expect(document).toContain('Sample tokens: display font, headline rhythm, label scale');
    expect(document).toContain('Claude Design review screen: Type');
    expect(document).toContain('GitHub repo: https://github.com/example/agent-harness');
    expect(document).toContain('No badges, pills, or card-heavy UI.');
  });

  it('builds a workspace bundle, critique result, and export artifacts', () => {
    const state = approveAllTokenReviews(updateOpenDesignBrief(createOpenDesignStudioState(), {
        projectName: 'Signal Desk',
        audience: 'Operations leads',
        prompt: 'Create a quiet operations dashboard system.',
      }),
      '2026-05-09T12:10:00.000Z',
    );
    const critique = runOpenDesignCritique(state);
    const bundle = buildOpenDesignWorkspaceBundle({ ...state, lastCritique: critique }, '2026-05-09T12:30:00.000Z');
    const html = createOpenDesignExportArtifact('html', state, '2026-05-09T12:45:00.000Z');
    const handoff = createOpenDesignExportArtifact('handoff', state, '2026-05-09T12:46:00.000Z');

    expect(critique.panelists).toHaveLength(5);
    expect(critique.gate).toBe('pass');
    expect(bundle.map((file) => file.path)).toEqual(expect.arrayContaining([
      'DESIGN.md',
      'design/open-design/research.json',
      'design/open-design/token-review.json',
      'design/open-design/preview.html',
      'design/open-design/critique.json',
      'design/open-design/handoff.md',
    ]));
    expect(bundle.find((file) => file.path === 'design/open-design/preview.html')?.content)
      .toContain('data-design-widget="primary-action"');
    expect(bundle.find((file) => file.path === 'design/open-design/token-review.json')?.content)
      .toContain('"composition"');
    expect(bundle.find((file) => file.path === 'design/open-design/token-review.json')?.content)
      .toContain('"visualLabel": "Action command sample"');
    expect(html.path).toBe('design/open-design/exports/signal-desk.html');
    expect(html.content).toContain('<!doctype html>');
    expect(handoff.path).toBe('design/open-design/exports/signal-desk-handoff.md');
    expect(handoff.content).toContain('Use DESIGN.md as the source of truth.');
  });

  it('covers default, fallback, revise, and non-html export paths', () => {
    const blankState = createOpenDesignStudioState({ workspaceName: 'Fallback' });
    const escapedState = createOpenDesignStudioState({
      brief: { projectName: `A & <B> "C" 'D'`, prompt: '', audience: '', surface: '', githubUrl: '', localFolder: '', designFile: '', assets: '', notes: '' },
      directionId: 'not-real' as never,
    });
    const punctuationState = createOpenDesignStudioState({
      brief: { projectName: '!!!', prompt: '', audience: '', surface: '', githubUrl: '', localFolder: '', designFile: '', assets: '', notes: '' },
    });
    const legacyReviewState = createOpenDesignStudioState({
      tokenReviews: createOpenDesignStudioState().tokenReviews.map(({ sample: _sample, ...item }) => item) as never,
    });
    const blankDocument = compileOpenDesignMd(blankState, '2026-05-09T13:00:00.000Z');
    const blankBundle = buildOpenDesignWorkspaceBundle(blankState, '2026-05-09T13:01:00.000Z');
    const escapedBundle = buildOpenDesignWorkspaceBundle(escapedState, '2026-05-09T13:01:30.000Z');
    const critique = runOpenDesignCritique(blankState);
    const cloudflare = createOpenDesignExportArtifact('cloudflare', blankState, '2026-05-09T13:02:00.000Z');
    const pdf = createOpenDesignExportArtifact('pdf', blankState, '2026-05-09T13:03:00.000Z');
    const fallbackSlug = createOpenDesignExportArtifact('zip', punctuationState, '2026-05-09T13:04:00.000Z');

    expect(OpenDesignStudio()).toBeNull();
    expect(blankDocument).toContain('name: Fallback DESIGN.md Studio');
    expect(blankDocument).toContain('No external sources attached yet.');
    expect(blankDocument).toContain('No special notes yet.');
    expect(blankBundle.map((file) => file.path)).not.toContain('design/open-design/critique.json');
    expect(escapedBundle.find((file) => file.path === 'design/open-design/preview.html')?.content)
      .toContain('A &amp; &lt;B&gt; &quot;C&quot; &#39;D&#39;');
    expect(critique.gate).toBe('revise');
    expect(critique.requiredFixes).toEqual([
      'Add a project name and a concrete design prompt before export.',
      'Approve every design-token review item before publishing DESIGN.md.',
    ]);
    expect(legacyReviewState.tokenReviews[0]?.sample.title).toBe('Display hierarchy');
    expect(cloudflare.path).toBe('design/open-design/exports/fallback-design-md-studio-cloudflare-deploy.md');
    expect(cloudflare.content).toContain('Cloudflare Pages deployment');
    expect(pdf.content).toContain('# PDF export');
    expect(fallbackSlug.path).toBe('design/open-design/exports/design-system.zip');
  });

  it('models Claude Design token revision approval and publish flow', () => {
    const state = updateOpenDesignBrief(createOpenDesignStudioState(), {
      projectName: 'Review Queue',
      prompt: 'Review extracted tokens before publishing.',
    });
    const composition = createOpenDesignApprovalComposition(state);
    const blockedPublish = publishOpenDesignSystem(state, 'Design lead', 'Try to publish early.', '2026-05-10T10:00:00.000Z');
    const requested = requestOpenDesignTokenRevision(blockedPublish, 'type-display', 'Aptos Display / 30px / 700', 'Design lead', 'Needs work: display type is too small.', '2026-05-10T10:02:00.000Z');
    const missingUpdate = approveOpenDesignTokenRevision(requested, 'missing-token', 'Design lead', 'No-op.', '2026-05-10T10:03:00.000Z');
    const approved = approveAllTokenReviews(missingUpdate, '2026-05-10T10:04:00.000Z');
    const published = publishOpenDesignSystem(approved, 'Design lead', 'Looks good. Publish as default.', '2026-05-10T10:05:00.000Z');
    const cloned = createOpenDesignStudioState({
      tokenReviews: approved.tokenReviews,
      approvalEvents: approved.approvalEvents,
      published: true,
      defaultForWorkspace: true,
    });
    const requestedCritique = runOpenDesignCritique(requested);
    const document = compileOpenDesignMd({ ...published, defaultForWorkspace: true }, '2026-05-10T10:06:00.000Z');
    const tokenReview = buildOpenDesignWorkspaceBundle(published, '2026-05-10T10:07:00.000Z')
      .find((file) => file.path === 'design/open-design/token-review.json');

    expect(composition.title).toBe('Agent Browser approval composition');
    expect(composition.regions.map((region) => region.label)).toEqual([
      'Workspace rail',
      'Conversation canvas',
      'Token inspector',
      'Approval footer',
    ]);
    expect(state.tokenReviews.every((item) => item.sample.visualLabel.length > 0)).toBe(true);
    expect(getOpenDesignApprovalSummary(state)).toMatchObject({ approved: 0, needsReview: 6, status: 'reviewing' });
    expect(blockedPublish.published).toBe(false);
    expect(requested.tokenReviews.find((item) => item.id === 'type-display')).toMatchObject({
      status: 'changes-requested',
      revision: 2,
      proposedValue: 'Aptos Display / 30px / 700',
    });
    expect(missingUpdate).toBe(requested);
    expect(getOpenDesignApprovalSummary(approved)).toMatchObject({ approved: 6, readyToPublish: true, status: 'ready' });
    expect(getOpenDesignApprovalSummary(cloned)).toMatchObject({ status: 'published' });
    expect(requestedCritique.score).toBeLessThan(8);
    expect(published.published).toBe(true);
    expect(document).toContain('status: published');
    expect(document).toContain('defaultForWorkspace: true');
    expect(tokenReview?.content).toContain('"readyToPublish": true');
  });

  it('exposes research and DESIGN.md tools through the plugin contract', async () => {
    const context = createHarnessExtensionContext();
    await context.plugins.load(createOpenDesignPlugin());

    const inventory = getOpenDesignResearchInventory();
    const toolInventory = await context.tools.execute('open-design.inventory', {});
    const toolDesign = await context.tools.execute('open-design.compile-design-md', {
      projectName: 'Plugin Contract',
      prompt: 'Compile the plugin contract.',
      directionId: 'editorial-monocle',
    });
    const fallbackDesign = await context.tools.execute('open-design.compile-design-md', null);
    const critique = await context.tools.execute('open-design.critique', {
      projectName: 'Critique Contract',
      prompt: 'Review the generated system.',
    });
    const fallbackCritique = await context.tools.execute('open-design.critique', null);
    const command = await context.commands.execute('/opendesign artifact studio');
    const defaultCommand = await context.commands.execute('/opendesign');

    expect(inventory.screenshotReferences.length).toBeGreaterThanOrEqual(8);
    expect(toolInventory).toMatchObject({ userFlows: expect.arrayContaining(['Brief capture', 'Approval and publish']) });
    expect(toolDesign).toMatchObject({
      path: 'DESIGN.md',
      content: expect.stringContaining('Plugin Contract'),
    });
    expect(fallbackDesign).toMatchObject({
      path: 'DESIGN.md',
      content: expect.stringContaining('Design workspace DESIGN.md Studio'),
    });
    expect(critique).toMatchObject({ gate: 'revise' });
    expect(fallbackCritique).toMatchObject({ gate: 'revise' });
    expect(command).toEqual({
      matched: true,
      commandId: 'open-design.new',
      result: {
        type: 'prompt',
        prompt: expect.stringContaining('artifact studio'),
        args: {},
      },
    });
    expect(defaultCommand).toEqual({
      matched: true,
      commandId: 'open-design.new',
      result: {
        type: 'prompt',
        prompt: expect.stringContaining('a new AI-native design system'),
        args: {},
      },
    });
  });
});

function approveAllTokenReviews(state: ReturnType<typeof createOpenDesignStudioState>, timestamp: string) {
  return state.tokenReviews.reduce(
    (current, item, index) => approveOpenDesignTokenRevision(
      current,
      item.id,
      'Design lead',
      'Looks good.',
      `${timestamp}:${index}`,
    ),
    state,
  );
}
