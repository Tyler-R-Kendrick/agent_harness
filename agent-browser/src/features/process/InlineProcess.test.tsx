import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InlineProcess } from './InlineProcess';
import type { ChatMessage } from '../../types';

describe('InlineProcess', () => {
  it('renders a neutral done pill when stale streaming status has no active work', () => {
    const message: ChatMessage = {
      id: 'assistant-1',
      role: 'assistant',
      content: 'Done.',
      status: 'streaming',
      isThinking: false,
      isVoting: false,
      processEntries: [{
        id: 'workflow-complete',
        kind: 'completion',
        actor: 'workflow-complete',
        summary: 'Workflow complete',
        branchId: 'main',
        status: 'done',
        ts: 1_000,
        endedAt: 2_000,
        position: 1,
      }],
    };

    render(<InlineProcess message={message} />);

    expect(screen.queryByText(/Working/i)).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: /Process · 1 event · 1s/i });
    expect(trigger).not.toHaveClass('process-pill-active');
  });
});
