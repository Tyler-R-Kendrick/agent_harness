import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../../types';
import { ActivityPanel, formatReasoningDuration, getRenderableReasoningSteps, InlineReasoning } from './ReasoningUi';

const baseMessage: ChatMessage = {
  id: 'assistant-1',
  role: 'assistant',
  content: '',
  status: 'complete',
  thinkingDuration: 64,
  reasoningStartedAt: 1000,
  reasoningSteps: [
    {
      id: 'step-1',
      kind: 'thinking',
      title: 'Pulling together current sources',
      body: 'I am pulling together current sources so the response stays anchored in what changed.',
      startedAt: 1000,
      endedAt: 1020,
      status: 'done',
    },
    {
      id: 'step-2',
      kind: 'search',
      title: 'Searching openreview.net',
      sources: [{ domain: 'openreview.net', url: 'https://openreview.net' }],
      startedAt: 1021,
      endedAt: 1040,
      status: 'done',
    },
  ],
};

describe('ReasoningUi', () => {
  it('formats reasoning durations for the summary pill and activity header', () => {
    expect(formatReasoningDuration(64)).toBe('1m 4s');
    expect(formatReasoningDuration(9)).toBe('9s');
  });

  it('shows the thought pill and calls the activity callback on click', () => {
    const onOpenActivity = vi.fn();
    render(<InlineReasoning message={baseMessage} onOpenActivity={onOpenActivity} />);

    // Summary text is NOT shown inline — it lives only inside the Activity overlay
    expect(screen.queryByText('I am pulling together current sources so the response stays anchored in what changed.')).not.toBeInTheDocument();

    const pill = screen.getByRole('button', { name: /Thought for 1m 4s/i });
    expect(pill).toBeInTheDocument();

    fireEvent.click(pill);
    expect(onOpenActivity).toHaveBeenCalledWith('assistant-1');
  });

  it('renders the activity overlay with timeline steps, source chips, and back button', () => {
    render(<ActivityPanel message={baseMessage} onClose={() => undefined} />);

    expect(screen.getByText('Thoughts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to chat' })).toBeInTheDocument();
    expect(screen.getByText('openreview.net')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('falls back to legacy thinking text when structured steps are unavailable', () => {
    const legacyMessage: ChatMessage = {
      id: 'assistant-legacy',
      role: 'assistant',
      content: '',
      status: 'complete',
      thinkingContent: 'First checkpoint\n\nSecond checkpoint',
      thinkingDuration: 12,
      isThinking: false,
    };

    expect(getRenderableReasoningSteps(legacyMessage)).toHaveLength(2);
  });
});