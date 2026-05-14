import { describe, expect, it } from 'vitest';
import {
  AI_POINTER_ACTIONS,
  DEFAULT_AI_POINTER_SETTINGS,
  buildAiPointerPrompt,
  buildAiPointerPromptContext,
  captureAiPointerTarget,
  isAiPointerFeatureState,
  isAiPointerSettings,
  isAiPointerTarget,
  suggestAiPointerActions,
  type AiPointerActionId,
} from './aiPointer';

const tab = {
  id: 'tab-1',
  title: 'Modern floor lamps',
  url: 'https://shop.example/floor-lamps',
};

describe('aiPointer', () => {
  it('captures a browser-page point with normalized coordinates, entities, and provenance', () => {
    const target = captureAiPointerTarget({
      tab,
      viewport: { width: 1200, height: 800 },
      point: { x: 300, y: 420 },
      targetKind: 'product',
      semanticLabel: 'brass arched floor lamp',
      selectedText: '$149 brass arched floor lamp, warm LED bulb included',
      entities: [
        { type: 'product', label: 'brass arched floor lamp' },
        { type: 'price', label: '$149' },
      ],
      now: new Date('2026-05-13T18:00:00.000Z'),
    });

    expect(target).toMatchObject({
      id: 'ai-pointer:tab-1:2026-05-13T18:00:00.000Z',
      tab,
      targetKind: 'product',
      semanticLabel: 'brass arched floor lamp',
      selectedText: '$149 brass arched floor lamp, warm LED bulb included',
      coordinates: {
        x: 300,
        y: 420,
        xPercent: 25,
        yPercent: 52.5,
      },
      entities: [
        { type: 'product', label: 'brass arched floor lamp' },
        { type: 'price', label: '$149' },
      ],
    });
    expect(buildAiPointerPromptContext(target)).toContain('Page: Modern floor lamps (https://shop.example/floor-lamps)');
    expect(buildAiPointerPromptContext(target)).toContain('Point: 25% from left, 52.5% from top');
    expect(buildAiPointerPromptContext(target)).toContain('Entity hints: product: brass arched floor lamp; price: $149');
    expect(buildAiPointerPromptContext(captureAiPointerTarget({
      tab,
      viewport: { width: 1200, height: 800 },
      point: { x: 300, y: 420 },
    }))).not.toContain('null');
  });

  it('suggests action parity for comparison, image editing, map lookup, recipe scaling, and canvas edits', () => {
    const selectedProducts = captureAiPointerTarget({
      tab,
      viewport: { width: 1000, height: 1000 },
      point: { x: 500, y: 500 },
      targetKind: 'product',
      references: [
        { label: 'Lamp A', kind: 'product' },
        { label: 'Lamp B', kind: 'product' },
      ],
    });
    const image = captureAiPointerTarget({
      tab: { ...tab, title: 'Living room moodboard' },
      viewport: { width: 800, height: 600 },
      point: { x: 720, y: 80 },
      targetKind: 'image',
    });
    const place = captureAiPointerTarget({
      tab: { ...tab, title: 'Weekend guide', url: 'https://travel.example/chicago' },
      viewport: { width: 800, height: 600 },
      point: { x: 100, y: 180 },
      targetKind: 'place',
      entities: [{ type: 'place', label: 'Museum Campus' }],
    });
    const recipe = captureAiPointerTarget({
      tab: { ...tab, title: 'Dinner recipe', url: 'https://cook.example/soup' },
      viewport: { width: 800, height: 600 },
      point: { x: 200, y: 220 },
      targetKind: 'recipe',
    });
    const canvasObject = captureAiPointerTarget({
      tab: { ...tab, title: 'Workflow canvas', url: 'agent-browser://workspace/canvas' },
      viewport: { width: 800, height: 600 },
      point: { x: 200, y: 220 },
      targetKind: 'object',
    });

    expect(suggestAiPointerActions(selectedProducts).map((action) => action.id)).toEqual(
      expect.arrayContaining(['explain-this', 'compare-selected']),
    );
    expect(suggestAiPointerActions(image).map((action) => action.id)).toEqual(
      expect.arrayContaining(['edit-image', 'visualize-here']),
    );
    expect(suggestAiPointerActions(place).map((action) => action.id)).toEqual(
      expect.arrayContaining(['find-places']),
    );
    expect(suggestAiPointerActions(recipe).map((action) => action.id)).toEqual(
      expect.arrayContaining(['double-recipe']),
    );
    expect(suggestAiPointerActions(canvasObject).map((action) => action.id)).toEqual(
      expect.arrayContaining(['move-this', 'merge-those', 'add-that']),
    );
  });

  it('builds an inline chat prompt that resolves this-that shorthand to the pointed target', () => {
    const target = captureAiPointerTarget({
      tab,
      viewport: { width: 1200, height: 800 },
      point: { x: 1020, y: 120 },
      targetKind: 'image',
      semanticLabel: 'lamp product photo',
      references: [
        { label: 'Lamp A', kind: 'product', text: 'Brass finish' },
        { label: 'Lamp B', kind: 'product', text: 'Matte black finish' },
      ],
      now: new Date('2026-05-13T18:15:00.000Z'),
    });

    const prompt = buildAiPointerPrompt({
      actionId: 'compare-selected',
      command: 'Compare these and make this one match that style.',
      target,
    });

    expect(prompt).toContain('AI Pointer request');
    expect(prompt).toContain('Action: Compare selected things');
    expect(prompt).toContain('User command: Compare these and make this one match that style.');
    expect(prompt).toContain('this/that/these/those refer to the pointed target and references above');
    expect(prompt).toContain('Reference 1: Lamp A (product) - Brass finish');
    expect(prompt).toContain('Reference 2: Lamp B (product) - Matte black finish');
    expect(prompt).toContain('Keep the user in flow and ask for confirmation before changing external state.');
  });

  it('validates persisted settings and state payloads', () => {
    expect(isAiPointerSettings(DEFAULT_AI_POINTER_SETTINGS)).toBe(true);
    expect(isAiPointerSettings(null)).toBe(false);
    expect(isAiPointerSettings({ enabled: true, requireConfirmation: false, captureMode: 'screen-region' })).toBe(false);
    expect(isAiPointerSettings({ ...DEFAULT_AI_POINTER_SETTINGS, enabled: 'yes' })).toBe(false);
    expect(isAiPointerTarget('not-a-target')).toBe(false);
    const validTarget = captureAiPointerTarget({
      tab,
      viewport: { width: 1, height: 1 },
      point: { x: 5, y: -2 },
    });
    const fallbackViewportTarget = captureAiPointerTarget({
      tab,
      viewport: { width: 0, height: Number.NaN },
      point: { x: Number.POSITIVE_INFINITY, y: -4 },
      entities: [null, { type: 'place', label: 'Chicago' }] as never,
    });
    expect(fallbackViewportTarget.coordinates).toMatchObject({ x: 1, y: 0, xPercent: 100, yPercent: 0 });
    expect(fallbackViewportTarget.entities).toEqual([{ type: 'place', label: 'Chicago' }]);
    expect(isAiPointerTarget({ ...validTarget, tab: null })).toBe(false);
    expect(isAiPointerTarget({ ...validTarget, coordinates: null })).toBe(false);
    expect(isAiPointerTarget({ ...validTarget, references: [null] })).toBe(false);
    expect(isAiPointerFeatureState({
      settings: DEFAULT_AI_POINTER_SETTINGS,
      lastTarget: validTarget,
    })).toBe(true);
    expect(isAiPointerFeatureState('not-state')).toBe(false);
    expect(isAiPointerFeatureState({ settings: DEFAULT_AI_POINTER_SETTINGS, lastTarget: { targetKind: 'bad' } })).toBe(false);
    expect(Object.keys(AI_POINTER_ACTIONS)).toEqual([
      'explain-this',
      'summarize-selection',
      'compare-selected',
      'rewrite-this',
      'chart-table',
      'edit-image',
      'find-places',
      'visualize-here',
      'double-recipe',
      'move-this',
      'merge-those',
      'add-that',
    ]);
  });

  it('covers settings filters, shorthand fallbacks, and non-provenance prompt variants', () => {
    const textTarget = captureAiPointerTarget({
      tab,
      viewport: { width: 600, height: 400 },
      point: { x: 10, y: 12 },
      targetKind: 'text',
      selectedText: 'Rewrite this description.',
      entities: [{ type: 'quantity', label: '2 cups' }],
      references: [{ label: 'Style guide', kind: 'paragraph' }],
    });
    const disabledSettings = { ...DEFAULT_AI_POINTER_SETTINGS, enabled: false };
    const narrowSettings = {
      ...DEFAULT_AI_POINTER_SETTINGS,
      includePageProvenance: false,
      includeEntityHints: false,
      requireConfirmation: false,
      quickActions: ['rewrite-this', 'double-recipe'] as AiPointerActionId[],
    };
    const appRegionTarget = captureAiPointerTarget({
      tab: { id: 'canvas', title: 'Workflow canvas', url: 'agent-browser://workspace/canvas' },
      viewport: { width: 600, height: 400 },
      point: { x: 610, y: -12 },
    });
    const placeEntityTarget = captureAiPointerTarget({
      tab,
      viewport: { width: 600, height: 400 },
      point: { x: 10, y: 12 },
      targetKind: 'paragraph',
      entities: [{ type: 'address', label: '1600 Amphitheatre Parkway' }],
    });
    const imageTarget = captureAiPointerTarget({
      tab,
      viewport: { width: 600, height: 400 },
      point: { x: 100, y: 120 },
      targetKind: 'image',
    });

    expect(suggestAiPointerActions(textTarget, disabledSettings)).toEqual([]);
    expect(suggestAiPointerActions(textTarget, narrowSettings).map((action) => action.id)).toEqual([
      'rewrite-this',
      'double-recipe',
    ]);
    expect(suggestAiPointerActions(appRegionTarget).map((action) => action.id)).toEqual(
      expect.arrayContaining(['move-this', 'merge-those', 'add-that']),
    );
    expect(suggestAiPointerActions(placeEntityTarget).map((action) => action.id)).toContain('find-places');
    expect(suggestAiPointerActions(imageTarget).map((action) => action.id)).not.toContain('summarize-selection');

    const context = buildAiPointerPromptContext(textTarget, narrowSettings);
    expect(context).not.toContain('Page:');
    expect(context).not.toContain('Entity hints:');
    expect(context).toContain('Reference 1: Style guide (paragraph)');
    expect(context).not.toContain('Style guide (paragraph) -');

    const prompt = buildAiPointerPrompt({
      actionId: 'rewrite-this',
      command: '   ',
      target: textTarget,
      settings: narrowSettings,
    });

    expect(prompt).toContain('User command: Rewrite the selected text while preserving intent.');
    expect(prompt).toContain('proceed when the requested action is reversible');
  });
});
