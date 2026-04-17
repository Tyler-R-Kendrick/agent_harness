import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { OperationStep } from './types';
import {
  OperationPane,
  OperationTimeline,
  OperationTrigger,
  formatOperationDuration,
} from './OperationPane';

// ─── Fixtures ─────────────────────────────────────────────────────────────

const doneStep: OperationStep = {
  id: 'step-1',
  kind: 'thinking',
  title: 'Planning the response',
  body: 'Gathering context before answering.',
  startedAt: 1000,
  endedAt: 1020,
  status: 'done',
};

const searchStep: OperationStep = {
  id: 'step-2',
  kind: 'search',
  title: 'Searching openreview.net',
  sources: [{ domain: 'openreview.net', url: 'https://openreview.net' }],
  startedAt: 1021,
  endedAt: 1040,
  status: 'done',
};

const activeStep: OperationStep = {
  id: 'step-3',
  kind: 'thinking',
  title: 'Formulating answer',
  startedAt: 1041,
  status: 'active',
};

// ─── formatOperationDuration ──────────────────────────────────────────────

describe('formatOperationDuration', () => {
  it('formats seconds-only durations', () => {
    expect(formatOperationDuration(9)).toBe('9s');
    expect(formatOperationDuration(0)).toBe('0s');
  });

  it('formats minutes + remainder seconds', () => {
    expect(formatOperationDuration(64)).toBe('1m 4s');
    expect(formatOperationDuration(90)).toBe('1m 30s');
  });

  it('formats exact minutes with no seconds remainder', () => {
    expect(formatOperationDuration(60)).toBe('1m');
    expect(formatOperationDuration(120)).toBe('2m');
  });

  it('treats undefined as 0', () => {
    expect(formatOperationDuration(undefined)).toBe('0s');
  });
});

// ─── OperationTimeline ────────────────────────────────────────────────────

describe('OperationTimeline', () => {
  it('renders step titles', () => {
    render(<OperationTimeline steps={[doneStep, searchStep]} />);
    expect(screen.getByText('Planning the response')).toBeInTheDocument();
    expect(screen.getByText('Searching openreview.net')).toBeInTheDocument();
  });

  it('renders step body text', () => {
    render(<OperationTimeline steps={[doneStep]} />);
    expect(screen.getByText('Gathering context before answering.')).toBeInTheDocument();
  });

  it('renders source chips with domain label', () => {
    render(<OperationTimeline steps={[searchStep]} />);
    expect(screen.getByText('openreview.net')).toBeInTheDocument();
  });

  it('shows a hidden-chip count when more than 2 sources', () => {
    const stepWithManySources: OperationStep = {
      ...searchStep,
      id: 'step-many',
      sources: [
        { domain: 'example.com' },
        { domain: 'another.com' },
        { domain: 'third.com' },
        { domain: 'fourth.com' },
      ],
    };
    render(<OperationTimeline steps={[stepWithManySources]} />);
    expect(screen.getByText('2 more')).toBeInTheDocument();
  });

  it('renders nothing when steps array is empty', () => {
    const { container } = render(<OperationTimeline steps={[]} />);
    expect(container.querySelector('.op-timeline')?.children.length).toBe(0);
  });
});

// ─── OperationTrigger ─────────────────────────────────────────────────────

describe('OperationTrigger', () => {
  it('shows activeLabel and calls onOpen while active', () => {
    const onOpen = vi.fn();
    render(<OperationTrigger isActive={true} activeLabel="Thinking…" onOpen={onOpen} />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveTextContent('Thinking…');
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('applies activeClassName to the active button', () => {
    render(<OperationTrigger isActive={true} activeClassName="my-shimmer" />);
    expect(screen.getByRole('button')).toHaveClass('my-shimmer');
  });

  it('shows done label with duration and calls onOpen when done', () => {
    const onOpen = vi.fn();
    render(
      <OperationTrigger
        isActive={false}
        durationSeconds={64}
        doneLabelPrefix="Thought for"
        onOpen={onOpen}
      />,
    );
    const btn = screen.getByRole('button', { name: /Thought for 1m 4s/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('returns null when not active and no durationSeconds', () => {
    const { container } = render(<OperationTrigger isActive={false} />);
    expect(container.firstChild).toBeNull();
  });
});

// ─── OperationPane ────────────────────────────────────────────────────────

describe('OperationPane', () => {
  it('renders title and steps', () => {
    render(
      <OperationPane
        steps={[doneStep, searchStep]}
        title="Thoughts"
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText('Thoughts')).toBeInTheDocument();
    expect(screen.getByText('Planning the response')).toBeInTheDocument();
  });

  it('uses a custom ariaLabel on the aside', () => {
    render(
      <OperationPane
        steps={[doneStep]}
        title="Thoughts"
        ariaLabel="Activity panel"
        onClose={() => undefined}
      />,
    );
    expect(screen.getByRole('complementary', { name: 'Activity panel' })).toBeInTheDocument();
  });

  it('renders the back button with a custom backLabel', () => {
    render(
      <OperationPane
        steps={[doneStep]}
        backLabel="Back to chat"
        onClose={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: 'Back to chat' })).toBeInTheDocument();
  });

  it('calls onClose when the back button is clicked', () => {
    const onClose = vi.fn();
    render(<OperationPane steps={[doneStep]} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows a default footer with duration and Done text when complete', () => {
    render(
      <OperationPane steps={[doneStep]} durationSeconds={64} onClose={() => undefined} />,
    );
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getAllByText('1m 4s').length).toBeGreaterThanOrEqual(1);
  });

  it('hides the default footer while isActive', () => {
    render(
      <OperationPane
        steps={[activeStep]}
        isActive={true}
        durationSeconds={10}
        onClose={() => undefined}
      />,
    );
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
  });

  it('renders a custom footer when provided', () => {
    render(
      <OperationPane
        steps={[doneStep]}
        durationSeconds={64}
        footer={<footer>Custom footer</footer>}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText('Custom footer')).toBeInTheDocument();
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
  });

  it('returns null when steps are empty and not active', () => {
    const { container } = render(
      <OperationPane steps={[]} isActive={false} onClose={() => undefined} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders while active even if steps are empty', () => {
    render(
      <OperationPane steps={[]} isActive={true} onClose={() => undefined} />,
    );
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });
});
