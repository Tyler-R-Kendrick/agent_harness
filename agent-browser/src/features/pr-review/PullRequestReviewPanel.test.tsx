import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildPullRequestReview, createSamplePullRequestReviewInput } from '../../services/prReviewUnderstanding';
import { PullRequestReviewPanel } from './PullRequestReviewPanel';

describe('PullRequestReviewPanel', () => {
  it('renders grouped changes, risks, validation evidence, and reviewer comments', () => {
    const report = buildPullRequestReview(createSamplePullRequestReviewInput('Agent Browser'));

    render(<PullRequestReviewPanel report={report} onStartFollowUp={vi.fn()} />);

    const panel = screen.getByRole('region', { name: 'Merge review understanding' });
    expect(panel).toHaveTextContent('Symphony branch merge review');
    expect(panel).toHaveTextContent('needs review');
    expect(within(panel).getByText('Runtime services and tools')).toBeInTheDocument();
    expect(within(panel).getByText('User-facing review surface')).toBeInTheDocument();
    expect(within(panel).getByText('Agent Browser verifier')).toBeInTheDocument();
    expect(within(panel).getByText('Symphony review visual smoke')).toBeInTheDocument();
    expect(within(panel).getByText('Reviewer')).toBeInTheDocument();
    expect(within(panel).getByText('Validation evidence incomplete')).toBeInTheDocument();
  });

  it('starts comment-driven follow-up prompts', () => {
    const report = buildPullRequestReview(createSamplePullRequestReviewInput('Agent Browser'));
    const onStartFollowUp = vi.fn();

    render(<PullRequestReviewPanel report={report} onStartFollowUp={onStartFollowUp} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start follow-up: Address Reviewer feedback' }));

    expect(onStartFollowUp).toHaveBeenCalledWith(expect.stringContaining('Reviewer request: Check that the review summary links validation evidence before approval.'));
  });

  it('renders ready review evidence without optional details or risks', () => {
    const report = buildPullRequestReview({
      title: 'Ready branch merge',
      author: 'agent-browser',
      summary: 'Ready merge approval.',
      changedFiles: ['agent-browser/src/App.css'],
      validations: [{ label: 'Agent Browser verifier', command: 'npm.cmd run verify:agent-browser', status: 'passed' }],
      browserEvidence: [{ label: 'Visual smoke', path: 'output/playwright/agent-browser-visual-smoke.png', kind: 'screenshot' }],
      reviewerComments: [],
    });

    render(<PullRequestReviewPanel report={report} onStartFollowUp={vi.fn()} />);

    const panel = screen.getByRole('region', { name: 'Merge review understanding' });
    expect(panel).toHaveTextContent('ready');
    expect(panel).toHaveTextContent('No review risks detected.');
    expect(within(panel).getByText('Agent Browser verifier')).toBeInTheDocument();
  });
});
