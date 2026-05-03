import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../../types';
import { ProcessPanel } from './ProcessPanel';

describe('ProcessPanel', () => {
  it('renders a trajectory critic verdict for recoverable tool failures', () => {
    const message: ChatMessage = {
      id: 'message-1',
      role: 'assistant',
      content: '',
      processEntries: [
        {
          id: 'tool-result-1',
          position: 0,
          ts: 1,
          kind: 'tool-result',
          actor: 'executor',
          summary: 'Command error',
          transcript: 'Error: test failed',
          status: 'done',
        },
      ],
    };

    render(<ProcessPanel message={message} onClose={vi.fn()} />);

    expect(screen.getByLabelText('Trajectory critic')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
    expect(screen.getByText('Tool error')).toBeInTheDocument();
  });
});
