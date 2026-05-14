import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../../types';
import { ProcessPanel } from './ProcessPanel';
import { buildRoutingDecisionRecord, persistRoutingDecisionRecord } from '../../services/routingObservability';

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

  it('renders suspended checkpoint metadata for resumable process handoffs', () => {
    const message: ChatMessage = {
      id: 'message-checkpoint',
      role: 'assistant',
      content: 'Waiting on approval.',
      status: 'streaming',
      processEntries: [
        {
          id: 'checkpoint:session-1:2026-05-07T03:00:00.000Z',
          position: 0,
          ts: 1000,
          kind: 'handoff',
          actor: 'checkpoint',
          summary: 'Approval before deployment',
          transcript: 'Suspended before deploy tool call.',
          status: 'active',
          payload: {
            checkpoint: {
              id: 'checkpoint:session-1:2026-05-07T03:00:00.000Z',
              sessionId: 'session-1',
              workspaceId: 'ws-research',
              reason: 'approval',
              status: 'suspended',
              summary: 'Approval before deployment',
              boundary: 'before deploy tool call',
              requiredInput: 'human approval',
              resumeToken: 'resume:session-1:2026-05-07T03:00:00.000Z',
              artifacts: ['plan.md'],
              createdAt: '2026-05-07T03:00:00.000Z',
              updatedAt: '2026-05-07T03:00:00.000Z',
              expiresAt: '2026-05-07T07:00:00.000Z',
            },
          },
        },
      ],
    };

    render(<ProcessPanel message={message} onClose={vi.fn()} />);

    expect(screen.getByLabelText('Suspended checkpoint')).toBeInTheDocument();
    expect(screen.getAllByText('Approval before deployment').length).toBeGreaterThan(0);
    expect(screen.getByText('approval')).toBeInTheDocument();
    expect(screen.getByText('resume:session-1:2026-05-07T03:00:00.000Z')).toBeInTheDocument();
  });

  it('renders routing diagnostics from persisted routing observability records', () => {
    window.localStorage.clear();
    persistRoutingDecisionRecord(buildRoutingDecisionRecord({
      requestId: 'routing-1',
      requestText: 'Please investigate latency and security issues with this workflow and auth policies.',
      selectedProvider: 'ghcp',
      selectedModel: 'gpt-5',
      benchmarkEvidenceSource: 'benchmark-router',
      routingDecision: { reasonCode: 'low-confidence-premium-escalation', confidence: 0.42, tier: 'premium', selectedBy: 'router' },
    }));

    const message: ChatMessage = {
      id: 'message-routing',
      role: 'assistant',
      content: 'Routed with diagnostics',
      processEntries: [],
    };

    render(<ProcessPanel message={message} onClose={vi.fn()} />);

    expect(screen.getByLabelText('Routing diagnostics')).toBeInTheDocument();
    expect(screen.getByText('Task class')).toBeInTheDocument();
    expect(screen.getByText(/benchmark-router/i)).toBeInTheDocument();
  });

});
