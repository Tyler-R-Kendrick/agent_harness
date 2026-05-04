import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../../types';
import { ProcessPanel } from './ProcessPanel';

describe('ProcessPanel', () => {
  it('renders the process graph without a browser trajectory critic verdict', () => {
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

    expect(screen.getByLabelText('Process graph')).toBeInTheDocument();
    expect(screen.queryByLabelText('Trajectory critic')).not.toBeInTheDocument();
    expect(screen.queryByText('Tool error')).not.toBeInTheDocument();
  });
});
