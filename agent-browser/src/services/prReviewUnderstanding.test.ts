import { describe, expect, it } from 'vitest';
import {
  buildPullRequestReview,
  buildReviewerFollowUpPrompt,
  createSamplePullRequestReviewInput,
} from './prReviewUnderstanding';

describe('prReviewUnderstanding', () => {
  it('groups changed files into semantic review sections with intent summaries', () => {
    const report = buildPullRequestReview({
      title: 'Add Symphony merge review',
      author: 'agent-browser',
      summary: 'Adds a Symphony merge gate that explains grouped changes and validation evidence.',
      changedFiles: [
        'agent-browser/src/chat-agents/Debugger/index.ts',
        'agent-browser/src/services/prReviewUnderstanding.ts',
        'agent-browser/src/features/pr-review/PullRequestReviewPanel.tsx',
        'agent-browser/src/features/pr-review/PullRequestReviewPanel.test.tsx',
        'docs/superpowers/plans/2026-05-03-review-native-pr-understanding.md',
      ],
      validations: [],
      browserEvidence: [],
      reviewerComments: [],
    });

    expect(report.groups.map((group) => group.title)).toEqual([
      'Agent routing and behavior',
      'Runtime services and tools',
      'User-facing review surface',
      'Validation and eval coverage',
      'Review evidence and documentation',
    ]);
    expect(report.groups[0]).toMatchObject({
      intent: 'Review chat-agent routing, prompts, or runtime behavior changes.',
      files: ['agent-browser/src/chat-agents/Debugger/index.ts'],
      riskLevel: 'high',
    });
    expect(report.summary).toBe('Adds a Symphony merge gate that explains grouped changes and validation evidence.');
  });

  it('highlights missing validation and sensitive runtime risks', () => {
    const report = buildPullRequestReview({
      title: 'Route provider tokens through shell tools',
      author: 'agent-browser',
      summary: 'Changes provider token handling and shell execution paths.',
      changedFiles: [
        'agent-browser/src/services/agentProvider.ts',
        'agent-browser/src/tools/cli/exec.ts',
      ],
      validations: [{ label: 'TypeScript', command: 'npm.cmd --workspace agent-browser run lint', status: 'passed' }],
      browserEvidence: [],
      reviewerComments: [{ author: 'Reviewer', body: 'Please prove token redaction in logs.' }],
    });

    expect(report.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'high',
        title: 'Sensitive runtime surface changed',
        recommendedCheck: 'Review secret handling, command execution, and permission boundaries before approval.',
      }),
      expect.objectContaining({
        severity: 'medium',
        title: 'No browser evidence linked',
      }),
    ]));
    expect(report.readiness.status).toBe('needs-review');
    expect(report.followUps.map((prompt) => prompt.title)).toContain('Address Reviewer feedback');
  });

  it('marks review evidence ready when validations and screenshots are linked', () => {
    const report = buildPullRequestReview({
      title: 'Tighten review UI',
      author: 'agent-browser',
      summary: '',
      changedFiles: ['agent-browser/src/App.css'],
      validations: [
        { label: 'Agent Browser verifier', command: 'npm.cmd run verify:agent-browser', status: 'passed' },
      ],
      browserEvidence: [
        { label: 'Visual smoke', path: 'output/playwright/agent-browser-visual-smoke.png', kind: 'screenshot' },
      ],
      reviewerComments: [],
    });

    expect(report.summary).toBe('Tighten review UI');
    expect(report.readiness).toMatchObject({ status: 'ready', passedValidations: 1, browserEvidenceCount: 1 });
    expect(report.risks.find((risk) => risk.title === 'No browser evidence linked')).toBeUndefined();
  });

  it('flags failed validation, durable state, and uncategorized merge files', () => {
    const report = buildPullRequestReview({
      title: 'Update workspace session merge state',
      author: 'agent-browser',
      summary: 'Keeps session state in sync while merging a generated manifest.',
      changedFiles: [
        'agent-browser/src/chat-agents/Debugger/index.ts',
        'agent-browser/src/App.tsx',
        'generated/merge-manifest.json',
      ],
      validations: [{ label: 'Agent Browser verifier', command: 'npm.cmd run verify:agent-browser', status: 'failed' }],
      browserEvidence: [{ label: 'Visual smoke', path: 'output/playwright/agent-browser-visual-smoke.png', kind: 'screenshot' }],
      reviewerComments: [],
    });

    expect(report.groups.map((group) => group.title)).toEqual([
      'Agent routing and behavior',
      'User-facing review surface',
      'Repository changes',
    ]);
    expect(report.groups[0].riskLevel).toBe('high');
    expect(report.groups[1].riskLevel).toBe('medium');
    expect(report.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'Validation failed' }),
      expect.objectContaining({ title: 'Durable workspace state changed' }),
    ]));
  });

  it('flags high-risk groups that have no passing validation', () => {
    const report = buildPullRequestReview({
      title: 'Adjust agent routing',
      author: 'agent-browser',
      summary: 'Changes the debugger branch handoff.',
      changedFiles: ['agent-browser/src/chat-agents/Debugger/index.ts'],
      validations: [],
      browserEvidence: [],
      reviewerComments: [],
    });

    expect(report.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'High-risk changes lack passing validation' }),
    ]));
  });

  it('normalizes object-shaped changed files and backslash paths', () => {
    const report = buildPullRequestReview({
      title: 'Normalize changed file objects',
      author: 'agent-browser',
      changedFiles: [{ path: 'agent-browser\\src\\App.css' }],
      validations: [],
      browserEvidence: [],
      reviewerComments: [],
    });

    expect(report.summary).toBe('Normalize changed file objects');
    expect(report.groups[0]).toMatchObject({
      title: 'User-facing review surface',
      files: ['agent-browser/src/App.css'],
    });
  });

  it('builds comment-driven follow-up prompts with review context', () => {
    const report = buildPullRequestReview(createSamplePullRequestReviewInput('Agent Browser'));
    const prompt = buildReviewerFollowUpPrompt(report, 'Check whether screenshot evidence covers the Symphony review surface.');

    expect(prompt).toContain('Review change set: Symphony branch merge review');
    expect(prompt).toContain('Check whether screenshot evidence covers the Symphony review surface.');
    expect(prompt).toContain('Highest risks:');
    expect(prompt).toContain('Changed groups:');
  });
});
