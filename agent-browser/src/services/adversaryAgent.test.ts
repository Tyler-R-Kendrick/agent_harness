import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADVERSARY_AGENT_SETTINGS,
  isAdversaryAgentSettings,
  normalizeAdversaryAgentSettings,
  planAdversaryCandidates,
  recordAdversaryJudgeFeedback,
} from './adversaryAgent';

describe('adversaryAgent', () => {
  it('clamps settings and rejects malformed storage payloads', () => {
    expect(isAdversaryAgentSettings(DEFAULT_ADVERSARY_AGENT_SETTINGS)).toBe(true);
    expect(isAdversaryAgentSettings({ enabled: true, maxCandidates: '3' })).toBe(false);
    expect(normalizeAdversaryAgentSettings({ ...DEFAULT_ADVERSARY_AGENT_SETTINGS, maxCandidates: 9 }).maxCandidates).toBe(5);
    expect(normalizeAdversaryAgentSettings({ ...DEFAULT_ADVERSARY_AGENT_SETTINGS, maxCandidates: -1 }).maxCandidates).toBe(1);
  });

  it('plans at least one bounded candidate from eval criteria and AgentBus trajectory', () => {
    const plan = planAdversaryCandidates({
      task: 'Implement checkout validation',
      evalCriteria: ['Reject invalid totals', 'Keep audit trail'],
      trajectory: ['Intent checkout', 'Vote policy rejected weak validation'],
      circularFailures: ['retrying the same invalid assertion'],
      settings: { ...DEFAULT_ADVERSARY_AGENT_SETTINGS, maxCandidates: 2 },
    });

    expect(plan.candidates).toHaveLength(2);
    expect(plan.candidates[0]).toMatchObject({
      id: 'adv-1',
      kind: 'adversary',
    });
    expect(plan.candidates[1]?.attackGoal).toContain('Keep audit trail');
    expect(plan.contextDigest).toContain('Reject invalid totals');
    expect(plan.contextDigest).toContain('Vote policy rejected weak validation');
    expect(plan.contextDigest).toContain('retrying the same invalid assertion');
  });

  it('emits one disabled placeholder candidate when adversary generation is off', () => {
    const plan = planAdversaryCandidates({
      task: 'Summarize the issue',
      evalCriteria: [],
      trajectory: [],
      circularFailures: [],
      settings: { ...DEFAULT_ADVERSARY_AGENT_SETTINGS, enabled: false },
    });

    expect(plan.candidates).toHaveLength(1);
    expect(plan.candidates[0]?.attackGoal).toContain('disabled');
  });

  it('records adversary wins as rerun feedback for future iterations', () => {
    const feedback = recordAdversaryJudgeFeedback({
      voterId: 'quality-gate',
      selectedCandidateId: 'adv-1',
      selectedCandidateKind: 'adversary',
      reason: 'Judge preferred an unsafe shortcut',
      settings: DEFAULT_ADVERSARY_AGENT_SETTINGS,
    });

    expect(feedback).toMatchObject({
      adversaryWon: true,
      shouldRerun: true,
      summary: 'Adversary candidate adv-1 fooled quality-gate.',
    });
    expect(feedback.feedbackForNextIteration).toContain('Judge preferred an unsafe shortcut');
  });

  it('keeps happy-path wins as feedback without forcing reruns', () => {
    const feedback = recordAdversaryJudgeFeedback({
      voterId: 'quality-gate',
      selectedCandidateId: 'happy-path',
      selectedCandidateKind: 'happy-path',
      reason: 'Judge selected the grounded answer',
      settings: DEFAULT_ADVERSARY_AGENT_SETTINGS,
    });

    expect(feedback.adversaryWon).toBe(false);
    expect(feedback.shouldRerun).toBe(false);
    expect(feedback.summary).toBe('Happy-path candidate happy-path passed quality-gate.');
  });
});
