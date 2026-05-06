import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../types';
import type { ProcessEntry } from './processLog';
import { scoreEvaluationRun } from './evaluationObservability';

describe('evaluationObservability', () => {
  it('scores live run traces and links scorer evidence to process entries', () => {
    const message: ChatMessage = {
      id: 'assistant-1',
      role: 'assistant',
      status: 'complete',
      content: 'Found the failing selector and patched the settings panel.',
      cards: [{ app: 'Browser evidence', args: { screenshot: 'output.png' } }],
    };
    const entries: ProcessEntry[] = [
      {
        id: 'trace-1',
        position: 0,
        ts: 1000,
        endedAt: 1400,
        kind: 'reasoning',
        actor: 'planner',
        summary: 'Plan',
        transcript: 'Inspect failure',
        status: 'done',
      },
      {
        id: 'tool-1',
        position: 1,
        ts: 1500,
        endedAt: 2100,
        kind: 'tool-call',
        actor: 'playwright',
        summary: 'Capture screenshot',
        payload: { screenshot: 'output.png' },
        status: 'done',
      },
      {
        id: 'done-1',
        position: 2,
        ts: 2200,
        endedAt: 2400,
        kind: 'completion',
        actor: 'completion-checker',
        summary: 'Done',
        status: 'done',
      },
    ];

    const scored = scoreEvaluationRun({ message, entries });

    expect(scored.verdict).toBe('passing');
    expect(scored.scorers.map((scorer) => scorer.id)).toEqual([
      'trace-coverage',
      'tool-reliability',
      'artifact-evidence',
      'latency-budget',
    ]);
    expect(scored.scorers.find((scorer) => scorer.id === 'artifact-evidence')?.evidenceEntryIds).toEqual(['tool-1']);
    expect(scored.datasetCase.caseId).toBe('eval-case:assistant-1');
    expect(scored.experiment.experimentId).toBe('live:assistant-1');
  });

  it('marks failed tool runs as needs review with failed scorer evidence', () => {
    const message: ChatMessage = {
      id: 'assistant-2',
      role: 'assistant',
      status: 'error',
      content: 'Tool execution failed.',
      isError: true,
    };
    const entries: ProcessEntry[] = [
      {
        id: 'tool-fail',
        position: 0,
        ts: 1000,
        endedAt: 2000,
        kind: 'tool-call',
        actor: 'shell',
        summary: 'Run verifier failed',
        transcript: 'spawn EPERM',
        status: 'failed',
      },
    ];

    const scored = scoreEvaluationRun({ message, entries });

    expect(scored.verdict).toBe('needs-review');
    expect(scored.scorers.find((scorer) => scorer.id === 'tool-reliability')).toMatchObject({
      status: 'failing',
      evidenceEntryIds: ['tool-fail'],
    });
    expect(scored.experiment.failingCount).toBeGreaterThan(0);
  });
});
