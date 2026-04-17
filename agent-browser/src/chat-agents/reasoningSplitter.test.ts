import { describe, expect, it } from 'vitest';
import type { ReasoningStep } from '../types';
import { createReasoningStepSplitter } from './reasoningSplitter';

function createRecorder() {
  const steps = new Map<string, ReasoningStep>();

  return {
    steps,
    splitter: createReasoningStepSplitter({
      createId: (() => {
        let index = 0;
        return () => `step-${++index}`;
      })(),
      now: (() => {
        let tick = 1000;
        return () => ++tick;
      })(),
      onStepStart: (step) => {
        steps.set(step.id, step);
      },
      onStepUpdate: (id, patch) => {
        const current = steps.get(id);
        if (!current) return;
        steps.set(id, { ...current, ...patch });
      },
      onStepEnd: () => undefined,
    }),
  };
}

describe('ReasoningStepSplitter', () => {
  it('splits paragraph-separated reasoning into completed steps', () => {
    const { splitter, steps } = createRecorder();

    splitter.push('Gathering benchmark evidence.\n\nComparing runtime behavior');
    splitter.finish();

    expect([...steps.values()]).toEqual([
      expect.objectContaining({
        id: 'step-1',
        title: 'Gathering benchmark evidence.',
        body: 'Gathering benchmark evidence.',
        status: 'done',
      }),
      expect.objectContaining({
        id: 'step-2',
        title: 'Comparing runtime behavior',
        body: 'Comparing runtime behavior',
        status: 'done',
      }),
    ]);
  });

  it('recognizes explicit search markers when enabled', () => {
    const steps = new Map<string, ReasoningStep>();
    const splitter = createReasoningStepSplitter({
      markers: true,
      createId: () => 'search-step',
      onStepStart: (step) => {
        steps.set(step.id, step);
      },
      onStepUpdate: (id, patch) => {
        const current = steps.get(id);
        if (!current) return;
        steps.set(id, { ...current, ...patch });
      },
    });

    splitter.push('###SEARCH: openreview.net\nLooking up benchmark lines');
    splitter.finish();

    expect(steps.get('search-step')).toEqual(expect.objectContaining({
      kind: 'search',
      title: 'openreview.net',
      body: 'Looking up benchmark lines',
      status: 'done',
    }));
  });
});