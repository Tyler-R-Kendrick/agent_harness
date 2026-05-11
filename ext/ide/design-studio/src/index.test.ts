import { createHarnessExtensionContext } from 'harness-core';
import { describe, expect, it } from 'vitest';
import {
  DESIGN_STUDIO_DIRECTIONS,
  DesignStudio,
  type DesignStudioExportKind,
  approveDesignStudioTokenRevision,
  buildDesignStudioArtifactFiles,
  buildDesignStudioProjectArtifactId,
  compileDesignStudioMd,
  createDesignStudioApprovalComposition,
  createDesignStudioExportArtifact,
  createDesignStudioPlugin,
  createDesignStudioProjectArtifactInput,
  createDesignStudioState,
  findDesignStudioProjectNameCollision,
  getDesignStudioApprovalSummary,
  getDesignStudioResearchInventory,
  publishDesignStudioSystem,
  requestDesignStudioTokenRevision,
  runDesignStudioCritique,
  selectDesignStudioDirection,
  updateDesignStudioBrief,
} from './index';

describe('Design Studio model', () => {
  it('captures research, directions, and a design brief into DESIGN.md', () => {
    const state = selectDesignStudioDirection(
      updateDesignStudioBrief(createDesignStudioState({ workspaceName: 'Research' }), {
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

    const document = compileDesignStudioMd(state, '2026-05-09T12:00:00.000Z');

    expect(DESIGN_STUDIO_DIRECTIONS.map((direction) => direction.id)).toContain('tech-utility');
    expect(document).toContain('name: Agent Browser Studio');
    expect(document).toContain('colors:');
    expect(document).toContain('styles:');
    expect(document).toContain('## Source Inventory');
    expect(document).toContain('## Token Review And Approval');
    expect(document).toContain('Status: reviewing. 0/6 token sections approved.');
    expect(document).toContain('Visual sample: Display hierarchy');
    expect(document).toContain('Sample tokens: display font, headline rhythm, label scale');
    expect(document).toContain('Design Studio review screen: Type');
    expect(document).toContain('GitHub repo: https://github.com/example/agent-harness');
    expect(document).toContain('No badges, pills, or card-heavy UI.');
  });

  it('builds artifact files, critique result, and export artifacts', () => {
    const state = approveAllTokenReviews(updateDesignStudioBrief(createDesignStudioState(), {
        projectName: 'Signal Desk',
        audience: 'Operations leads',
        prompt: 'Create a quiet operations dashboard system.',
      }),
      '2026-05-09T12:10:00.000Z',
    );
    const critique = runDesignStudioCritique(state);
    const bundle = buildDesignStudioArtifactFiles({ ...state, lastCritique: critique }, '2026-05-09T12:30:00.000Z');
    const html = createDesignStudioExportArtifact('html', state, '2026-05-09T12:45:00.000Z');
    const handoff = createDesignStudioExportArtifact('handoff', state, '2026-05-09T12:46:00.000Z');

    expect(critique.panelists).toHaveLength(5);
    expect(critique.gate).toBe('pass');
    expect(bundle.map((file) => file.path)).toEqual(expect.arrayContaining([
      'DESIGN.md',
      'research.json',
      'token-review.json',
      'preview.html',
      'critique.json',
      'handoff.md',
    ]));
    expect(bundle.find((file) => file.path === 'preview.html')?.content)
      .toContain('data-design-widget="primary-action"');
    expect(bundle.find((file) => file.path === 'token-review.json')?.content)
      .toContain('"composition"');
    expect(bundle.find((file) => file.path === 'token-review.json')?.content)
      .toContain('"visualLabel": "Action command sample"');
    expect(html.path).toBe('exports/signal-desk.html');
    expect(html.content).toContain('<!doctype html>');
    expect(handoff.path).toBe('exports/signal-desk-handoff.md');
    expect(handoff.content).toContain('Use DESIGN.md as the source of truth.');
  });

  it('emits Design Studio artifact files without legacy mounted design paths or borrowed product names', () => {
    const state = approveAllTokenReviews(updateDesignStudioBrief(createDesignStudioState(), {
        projectName: 'Signal Desk',
        audience: 'Operations leads',
        prompt: 'Create a quiet operations dashboard system.',
      }),
      '2026-05-09T12:10:00.000Z',
    );

    const bundle = buildDesignStudioArtifactFiles(state, '2026-05-09T12:30:00.000Z');
    const paths = bundle.map((file) => file.path);
    const serializedBundle = JSON.stringify(bundle);
    const serializedInventory = JSON.stringify(getDesignStudioResearchInventory());
    const legacyOpenProduct = ['Open', 'Design'].join('');
    const legacyOpenPhrase = ['Open', ' Design'].join('');
    const legacyOpenPath = ['open', 'design'].join('-');
    const legacyClaudePhrase = ['Claude', ' Design'].join('');
    const legacyClaudePath = ['claude', 'design'].join('-');
    const legacyClaudeSnake = ['claude', 'design'].join('_');
    const borrowedProductPattern = new RegExp([
      legacyOpenProduct,
      legacyOpenPhrase,
      legacyOpenPath,
      legacyClaudePhrase,
      legacyClaudePath,
      legacyClaudeSnake,
    ].join('|'));

    expect(paths).toEqual(expect.arrayContaining([
      'DESIGN.md',
      'research.json',
      'system.json',
      'token-review.json',
      'preview.html',
      'handoff.md',
    ]));
    expect(paths.some((path) => path.startsWith('design/'))).toBe(false);
    expect(paths.some((path) => path.includes(legacyOpenPath) || path.includes(legacyClaudePath))).toBe(false);
    expect(serializedBundle).not.toMatch(borrowedProductPattern);
    expect(serializedInventory).not.toMatch(borrowedProductPattern);
  });

  it('covers default, fallback, revise, and non-html export paths', () => {
    const blankState = createDesignStudioState({ workspaceName: 'Fallback' });
    const escapedState = createDesignStudioState({
      brief: { projectName: `A & <B> "C" 'D'`, prompt: '', audience: '', surface: '', githubUrl: '', localFolder: '', designFile: '', assets: '', notes: '' },
      directionId: 'not-real' as never,
    });
    const punctuationState = createDesignStudioState({
      brief: { projectName: '!!!', prompt: '', audience: '', surface: '', githubUrl: '', localFolder: '', designFile: '', assets: '', notes: '' },
    });
    const legacyReviewState = createDesignStudioState({
      tokenReviews: createDesignStudioState().tokenReviews.map(({ sample: _sample, ...item }) => item) as never,
    });
    const blankDocument = compileDesignStudioMd(blankState, '2026-05-09T13:00:00.000Z');
    const blankBundle = buildDesignStudioArtifactFiles(blankState, '2026-05-09T13:01:00.000Z');
    const escapedBundle = buildDesignStudioArtifactFiles(escapedState, '2026-05-09T13:01:30.000Z');
    const critique = runDesignStudioCritique(blankState);
    const cloudflare = createDesignStudioExportArtifact('cloudflare', blankState, '2026-05-09T13:02:00.000Z');
    const pdf = createDesignStudioExportArtifact('pdf', blankState, '2026-05-09T13:03:00.000Z');
    const pptx = createDesignStudioExportArtifact('pptx', blankState, '2026-05-09T13:03:30.000Z');
    const fallbackSlug = createDesignStudioExportArtifact('zip', punctuationState, '2026-05-09T13:04:00.000Z');
    const markdown = createDesignStudioExportArtifact('markdown', blankState, '2026-05-09T13:05:00.000Z');
    const json = createDesignStudioExportArtifact('json' as DesignStudioExportKind, blankState, '2026-05-09T13:06:00.000Z');
    const unknown = createDesignStudioExportArtifact('txt' as DesignStudioExportKind, blankState, '2026-05-09T13:07:00.000Z');

    expect(DesignStudio()).toBeNull();
    expect(blankDocument).toContain('name: Fallback DESIGN.md Studio');
    expect(blankDocument).toContain('No external sources attached yet.');
    expect(blankDocument).toContain('No special notes yet.');
    expect(blankBundle.map((file) => file.path)).not.toContain('critique.json');
    expect(escapedBundle.find((file) => file.path === 'preview.html')?.content)
      .toContain('A &amp; &lt;B&gt; &quot;C&quot; &#39;D&#39;');
    expect(critique.gate).toBe('revise');
    expect(critique.requiredFixes).toEqual([
      'Add a project name and a concrete design prompt before export.',
      'Approve every design-token review item before publishing DESIGN.md.',
    ]);
    expect(legacyReviewState.tokenReviews[0]?.sample.title).toBe('Display hierarchy');
    expect(cloudflare.path).toBe('exports/fallback-design-md-studio-cloudflare-deploy.md');
    expect(cloudflare.content).toContain('Cloudflare Pages deployment');
    expect(pdf.content).toContain('# PDF export');
    expect(pptx.mediaType).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation');
    expect(fallbackSlug.path).toBe('exports/design-system.zip');
    expect(markdown.mediaType).toBe('text/markdown');
    expect(json.mediaType).toBe('application/json');
    expect(unknown.mediaType).toBe('text/plain');
  });

  it('models Design Studio project artifacts and workspace-wide artifact name collisions', () => {
    const state = updateDesignStudioBrief(createDesignStudioState(), {
      projectName: 'Signal Desk',
      audience: 'Operations leads',
      prompt: 'Create a quiet operations dashboard system.',
    });
    const artifact = createDesignStudioProjectArtifactInput(state, {
      timestamp: '2026-05-11T14:00:00.000Z',
      references: ['ref-a', 'ref-a', 'ref-b'],
    });
    const customArtifact = createDesignStudioProjectArtifactInput(state, {
      artifactId: 'custom-artifact',
      timestamp: '2026-05-11T14:01:00.000Z',
    });
    const defaultTimestampArtifact = createDesignStudioProjectArtifactInput(state);
    const titleCollision = findDesignStudioProjectNameCollision(state, [
      { id: 'artifact-1', title: 'Signal Desk' },
    ]);
    const idCollision = findDesignStudioProjectNameCollision(state, [
      { id: 'design-studio-signal-desk', title: 'Different title' },
    ]);
    const skippedCurrentArtifact = findDesignStudioProjectNameCollision(state, [
      { id: 'artifact-1', title: 'Signal Desk' },
    ], 'artifact-1');
    const noCollision = findDesignStudioProjectNameCollision(state, [
      { id: 'artifact-without-title', title: null },
    ]);

    expect(buildDesignStudioProjectArtifactId('Signal Desk')).toBe('design-studio-signal-desk');
    expect(artifact).toMatchObject({
      id: 'design-studio-signal-desk',
      title: 'Signal Desk',
      description: 'Design Studio project artifacts for Signal Desk.',
      kind: 'design-studio-project',
      references: ['ref-a', 'ref-b'],
    });
    expect(artifact.files.map((file) => file.path)).toEqual(expect.arrayContaining([
      'DESIGN.md',
      'research.json',
      'system.json',
      'token-review.json',
      'preview.html',
      'handoff.md',
    ]));
    expect(artifact.files.find((file) => file.path === 'research.json')?.mediaType).toBe('application/json');
    expect(customArtifact.id).toBe('custom-artifact');
    expect(defaultTimestampArtifact.files[0]?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(titleCollision).toEqual({ id: 'artifact-1', title: 'Signal Desk', field: 'title' });
    expect(idCollision).toEqual({ id: 'design-studio-signal-desk', title: 'Different title', field: 'id' });
    expect(skippedCurrentArtifact).toBeNull();
    expect(noCollision).toBeNull();
  });

  it('models Design Studio token revision approval and publish flow', () => {
    const state = updateDesignStudioBrief(createDesignStudioState(), {
      projectName: 'Review Queue',
      prompt: 'Review extracted tokens before publishing.',
    });
    const composition = createDesignStudioApprovalComposition(state);
    const blockedPublish = publishDesignStudioSystem(state, 'Design lead', 'Try to publish early.', '2026-05-10T10:00:00.000Z');
    const requested = requestDesignStudioTokenRevision(blockedPublish, 'type-display', 'Aptos Display / 30px / 700', 'Design lead', 'Needs work: display type is too small.', '2026-05-10T10:02:00.000Z');
    const missingUpdate = approveDesignStudioTokenRevision(requested, 'missing-token', 'Design lead', 'No-op.', '2026-05-10T10:03:00.000Z');
    const approved = approveAllTokenReviews(missingUpdate, '2026-05-10T10:04:00.000Z');
    const published = publishDesignStudioSystem(approved, 'Design lead', 'Looks good. Publish as default.', '2026-05-10T10:05:00.000Z');
    const cloned = createDesignStudioState({
      tokenReviews: approved.tokenReviews,
      approvalEvents: approved.approvalEvents,
      published: true,
      defaultForWorkspace: true,
    });
    const requestedCritique = runDesignStudioCritique(requested);
    const document = compileDesignStudioMd({ ...published, defaultForWorkspace: true }, '2026-05-10T10:06:00.000Z');
    const tokenReview = buildDesignStudioArtifactFiles(published, '2026-05-10T10:07:00.000Z')
      .find((file) => file.path === 'token-review.json');

    expect(composition.title).toBe('Agent Browser approval composition');
    expect(composition.regions.map((region) => region.label)).toEqual([
      'Workspace rail',
      'Conversation canvas',
      'Token inspector',
      'Approval footer',
    ]);
    expect(state.tokenReviews.every((item) => item.sample.visualLabel.length > 0)).toBe(true);
    expect(getDesignStudioApprovalSummary(state)).toMatchObject({ approved: 0, needsReview: 6, status: 'reviewing' });
    expect(blockedPublish.published).toBe(false);
    expect(requested.tokenReviews.find((item) => item.id === 'type-display')).toMatchObject({
      status: 'changes-requested',
      revision: 2,
      proposedValue: 'Aptos Display / 30px / 700',
    });
    expect(missingUpdate).toBe(requested);
    expect(getDesignStudioApprovalSummary(approved)).toMatchObject({ approved: 6, readyToPublish: true, status: 'ready' });
    expect(getDesignStudioApprovalSummary(cloned)).toMatchObject({ status: 'published' });
    expect(requestedCritique.score).toBeLessThan(8);
    expect(published.published).toBe(true);
    expect(document).toContain('status: published');
    expect(document).toContain('defaultForWorkspace: true');
    expect(tokenReview?.content).toContain('"readyToPublish": true');
  });

  it('exposes research and DESIGN.md tools through the plugin contract', async () => {
    const context = createHarnessExtensionContext();
    await context.plugins.load(createDesignStudioPlugin());

    const inventory = getDesignStudioResearchInventory();
    const toolInventory = await context.tools.execute('design-studio.inventory', {});
    const toolDesign = await context.tools.execute('design-studio.compile-design-md', {
      projectName: 'Plugin Contract',
      prompt: 'Compile the plugin contract.',
      directionId: 'editorial-monocle',
    });
    const fallbackDesign = await context.tools.execute('design-studio.compile-design-md', null);
    const critique = await context.tools.execute('design-studio.critique', {
      projectName: 'Critique Contract',
      prompt: 'Review the generated system.',
    });
    const fallbackCritique = await context.tools.execute('design-studio.critique', null);
    const command = await context.commands.execute('/design-studio artifact studio');
    const defaultCommand = await context.commands.execute('/design-studio');

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
      commandId: 'design-studio.new',
      result: {
        type: 'prompt',
        prompt: expect.stringContaining('artifact studio'),
        args: {},
      },
    });
    expect(defaultCommand).toEqual({
      matched: true,
      commandId: 'design-studio.new',
      result: {
        type: 'prompt',
        prompt: expect.stringContaining('a new AI-native design system'),
        args: {},
      },
    });
  });
});

function approveAllTokenReviews(state: ReturnType<typeof createDesignStudioState>, timestamp: string) {
  return state.tokenReviews.reduce(
    (current, item, index) => approveDesignStudioTokenRevision(
      current,
      item.id,
      'Design lead',
      'Looks good.',
      `${timestamp}:${index}`,
    ),
    state,
  );
}
