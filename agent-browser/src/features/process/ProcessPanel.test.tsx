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

  it('renders evaluation-native observability for a completed process run', () => {
    const message: ChatMessage = {
      id: 'message-eval',
      role: 'assistant',
      content: 'Captured visual evidence and completed the run.',
      status: 'complete',
      cards: [{ app: 'Browser evidence', args: { screenshot: 'agent-browser-visual-smoke.png' } }],
      processEntries: [
        {
          id: 'reasoning-1',
          position: 0,
          ts: 1000,
          endedAt: 1300,
          kind: 'reasoning',
          actor: 'planner',
          summary: 'Planned visual validation',
          transcript: 'Use the process graph and screenshot evidence.',
          status: 'done',
        },
        {
          id: 'tool-1',
          position: 1,
          ts: 1400,
          endedAt: 1800,
          kind: 'tool-call',
          actor: 'playwright',
          summary: 'Capture browser screenshot',
          payload: { screenshot: 'agent-browser-visual-smoke.png' },
          status: 'done',
        },
      ],
    };

    render(<ProcessPanel message={message} onClose={vi.fn()} />);

    expect(screen.getByText('Evaluation')).toBeInTheDocument();
    expect(screen.getByText('Trace coverage')).toBeInTheDocument();
    expect(screen.getByText('Tool reliability')).toBeInTheDocument();
    expect(screen.getByText('Artifact evidence')).toBeInTheDocument();
    expect(screen.getByText('eval-case:message-eval')).toBeInTheDocument();
    expect(screen.getByText('live:message-eval')).toBeInTheDocument();
  });
});
