import { beforeEach, describe, expect, it, vi } from 'vitest';

const driverInstanceMock = {
  drive: vi.fn(),
  destroy: vi.fn(),
};
const driverFactoryMock = vi.fn<(options: unknown) => typeof driverInstanceMock>(() => driverInstanceMock);

vi.mock('driver.js', () => ({
  driver: (options: unknown) => driverFactoryMock(options),
}));

import {
  DEFAULT_TOUR_TARGETS,
  buildGuidedTourPlan,
  sanitizeTourPlan,
  startDriverTour,
} from './driverTour';

describe('driver tour planner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    driverFactoryMock.mockClear();
    driverInstanceMock.drive.mockClear();
    driverInstanceMock.destroy.mockClear();
  });

  it('builds a targeted Driver.js tour for tool configuration help', () => {
    const plan = buildGuidedTourPlan({
      request: 'Show me how to configure tools before I send a prompt.',
      targets: DEFAULT_TOUR_TARGETS,
    });

    expect(plan.id).toBe('tools');
    expect(plan.title).toBe('Configure Tools');
    expect(plan.steps.length).toBeGreaterThanOrEqual(3);
    expect(plan.steps.map((step) => step.targetId)).toEqual(expect.arrayContaining([
      'agent-provider',
      'tools-picker',
      'chat-input',
    ]));
    expect(plan.steps[0]).toMatchObject({
      targetId: 'tools-picker',
      element: 'button[aria-label^="Configure tools"]',
      popover: {
        title: 'Configure tools',
      },
    });
    expect(plan.steps.every((step) => step.popover.title.trim() && step.popover.description.trim())).toBe(true);
  });

  it('adds and sorts request-matched targets outside the selected recipe', () => {
    const plan = buildGuidedTourPlan({
      request: 'Configure tools, then show the workspace switcher and terminal mode.',
      targets: DEFAULT_TOUR_TARGETS,
    });

    expect(plan.id).toBe('tools');
    expect(plan.steps.map((step) => step.targetId)).toEqual([
      'tools-picker',
      'agent-provider',
      'chat-input',
      'workspace-switcher',
      'terminal-mode',
      'chat-mode',
    ]);
  });

  it('deduplicates repeated scored targets before limiting the tour', () => {
    const plan = buildGuidedTourPlan({
      request: 'Configure tools with custom duplicate help.',
      targets: [
        ...DEFAULT_TOUR_TARGETS,
        {
          id: 'custom-duplicate',
          label: 'Custom duplicate',
          selector: '[data-tour="custom-one"]',
          description: 'First duplicate target.',
          keywords: ['custom', 'duplicate'],
        },
        {
          id: 'custom-duplicate',
          label: 'Custom duplicate copy',
          selector: '[data-tour="custom-two"]',
          description: 'Second duplicate target.',
          keywords: ['custom', 'duplicate'],
        },
      ],
    });

    expect(plan.steps.filter((step) => step.targetId === 'custom-duplicate')).toHaveLength(1);
  });

  it('sanitizes generated plans to the known tour target registry', () => {
    const plan = sanitizeTourPlan({
      id: 'generated',
      title: 'Generated Tour',
      steps: [
        {
          targetId: 'tools-picker',
          element: 'button[aria-label^="Configure tools"]',
          popover: { title: 'Tools', description: 'Pick the tools this turn can use.' },
        },
        {
          targetId: 'unsafe',
          element: 'script',
          popover: { title: 'Bad', description: 'Should not survive sanitization.' },
        },
        {
          targetId: 'chat-input',
          element: '[aria-label="Chat input"]',
          popover: { title: '', description: 'Missing title is filled from registry.' },
        },
      ],
    }, DEFAULT_TOUR_TARGETS);

    expect(plan.steps).toEqual([
      expect.objectContaining({ targetId: 'tools-picker', element: 'button[aria-label^="Configure tools"]' }),
      expect.objectContaining({
        targetId: 'chat-input',
        element: '[aria-label="Chat input"]',
        popover: expect.objectContaining({ title: 'Chat input' }),
      }),
    ]);
    expect(JSON.stringify(plan)).not.toContain('"targetId":"unsafe"');
    expect(JSON.stringify(plan)).not.toContain('"element":"script"');
  });

  it('rejects malformed steps and falls back when popover data is not an object', () => {
    const plan = sanitizeTourPlan({
      id: 'malformed',
      title: 'Malformed Tour',
      description: 'Only the registry-backed step should survive.',
      steps: [
        null,
        { element: '[aria-label="Chat input"]' },
        { targetId: 'tools-picker', element: '[aria-label="Chat input"]' },
        {
          targetId: 'tools-picker',
          element: 'button[aria-label^="Configure tools"]',
          popover: 'bad popover',
        },
      ],
    }, DEFAULT_TOUR_TARGETS);

    expect(plan.steps).toEqual([{
      targetId: 'tools-picker',
      element: 'button[aria-label^="Configure tools"]',
      popover: {
        title: 'Configure tools',
        description: 'Open this control to choose the tools available to the next agent turn.',
        side: 'left',
        align: 'start',
      },
    }]);
  });

  it('fills default plan metadata and supports targets without placement hints', () => {
    const plan = sanitizeTourPlan({
      steps: [{
        targetId: 'plain-target',
        element: '[data-tour="plain"]',
        popover: {},
      }],
    }, [{
      id: 'plain-target',
      label: 'Plain target',
      selector: '[data-tour="plain"]',
      description: 'A target without custom side or alignment.',
      keywords: ['plain'],
    }]);

    expect(plan).toEqual({
      id: 'guided-tour',
      title: 'Guided Tour',
      description: 'Follow the highlighted controls to learn this workflow.',
      steps: [{
        targetId: 'plain-target',
        element: '[data-tour="plain"]',
        popover: {
          title: 'Plain target',
          description: 'A target without custom side or alignment.',
        },
      }],
    });
  });

  it('returns an empty default plan for non-object generated content', () => {
    expect(sanitizeTourPlan('not a plan')).toEqual({
      id: 'guided-tour',
      title: 'Guided Tour',
      description: 'Follow the highlighted controls to learn this workflow.',
      steps: [],
    });
  });

  it('starts Driver.js with only DOM-present steps and reports skipped targets', () => {
    document.body.innerHTML = [
      '<select aria-label="Agent provider"></select>',
      '<button aria-label="Configure tools (3 of 12 selected)"></button>',
      '<textarea aria-label="Chat input"></textarea>',
    ].join('');
    const plan = buildGuidedTourPlan({
      request: 'Show me how to configure tools.',
      targets: DEFAULT_TOUR_TARGETS,
    });

    const result = startDriverTour(plan, { root: document, driverFactory: driverFactoryMock });

    expect(result.started).toBe(true);
    expect(result.stepCount).toBeGreaterThanOrEqual(3);
    expect(driverFactoryMock).toHaveBeenCalledWith(expect.objectContaining({
      showProgress: true,
      steps: expect.arrayContaining([
        expect.objectContaining({ element: 'button[aria-label^="Configure tools"]' }),
      ]),
    }));
    expect(driverInstanceMock.drive).toHaveBeenCalledOnce();
  });

  it('uses the global document when no explicit tour root is supplied', () => {
    document.body.innerHTML = '<textarea aria-label="Chat input"></textarea>';
    const plan = sanitizeTourPlan({
      id: 'chat',
      title: 'Chat Tour',
      description: 'Highlight chat.',
      steps: [{
        targetId: 'chat-input',
        element: '[aria-label="Chat input"]',
        popover: { title: 'Chat', description: 'Use chat.' },
      }],
    });

    const result = startDriverTour(plan, { driverFactory: driverFactoryMock });

    expect(result).toEqual({
      started: true,
      stepCount: 1,
      skippedTargetIds: [],
    });
  });

  it('falls back to a modal-only Driver.js step when no targets are mounted', () => {
    const plan = buildGuidedTourPlan({
      request: 'Walk me through the workspace.',
      targets: DEFAULT_TOUR_TARGETS,
    });

    const result = startDriverTour(plan, { root: document, driverFactory: driverFactoryMock });

    expect(result.started).toBe(true);
    expect(result.stepCount).toBe(1);
    expect(result.skippedTargetIds.length).toBeGreaterThan(0);
    expect(driverFactoryMock).toHaveBeenCalledWith(expect.objectContaining({
      steps: [expect.objectContaining({
        popover: expect.objectContaining({
          title: 'Tour targets are not visible',
        }),
      })],
    }));
  });

  it('reports a skipped tour when Driver.js has no document to inspect', () => {
    const plan = buildGuidedTourPlan({
      request: 'Show me how to configure tools.',
      targets: DEFAULT_TOUR_TARGETS,
    });
    const originalDocument = globalThis.document;
    vi.stubGlobal('document', undefined);

    try {
      expect(startDriverTour(plan)).toEqual({
        started: false,
        stepCount: 0,
        skippedTargetIds: plan.steps.map((step) => step.targetId),
        error: 'No document is available for Driver.js.',
      });
      expect(driverFactoryMock).not.toHaveBeenCalled();
    } finally {
      vi.stubGlobal('document', originalDocument);
    }
  });
});
