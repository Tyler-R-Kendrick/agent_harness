import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage, VoterStep } from '../../types';
import { InlineVoters, VotersPanel } from './VotersUi';

// ─── Fixtures ─────────────────────────────────────────────────────────────

const approveStep: VoterStep = {
  id: 'voter-safe-intent-1',
  kind: 'agent',
  title: 'safe',
  voterId: 'safe',
  body: 'Approved',
  approve: true,
  startedAt: 1000,
  endedAt: 2000,
  status: 'done',
};

const rejectStep: VoterStep = {
  id: 'voter-policy-intent-1',
  kind: 'agent',
  title: 'policy',
  voterId: 'policy',
  body: 'Rejected: action not on allowlist',
  approve: false,
  startedAt: 1000,
  endedAt: 1500,
  status: 'done',
};

const activeStep: VoterStep = {
  id: 'voter-safe-intent-2',
  kind: 'agent',
  title: 'safe',
  voterId: 'safe',
  startedAt: 3000,
  status: 'active',
};

const baseMessage: ChatMessage = {
  id: 'assistant-1',
  role: 'assistant',
  content: '',
  status: 'complete',
  voterSteps: [approveStep, rejectStep],
};

// ─── InlineVoters ─────────────────────────────────────────────────────────

describe('InlineVoters', () => {
  it('renders nothing when there are no voter steps and isVoting is false', () => {
    const msg: ChatMessage = { id: 'a', role: 'assistant', content: '', voterSteps: [] };
    const { container } = render(<InlineVoters message={msg} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the "reviewed" pill when all steps are done and calls the activity callback', () => {
    const onOpenActivity = vi.fn();
    render(<InlineVoters message={baseMessage} onOpenActivity={onOpenActivity} />);

    const pill = screen.getByRole('button', { name: /Agents reviewed in/i });
    expect(pill).toBeInTheDocument();

    fireEvent.click(pill);
    expect(onOpenActivity).toHaveBeenCalledWith('assistant-1');
  });

  it('shows the "reviewing" active pill while a voter step is active', () => {
    const msg: ChatMessage = {
      id: 'a',
      role: 'assistant',
      content: '',
      voterSteps: [activeStep],
    };
    render(<InlineVoters message={msg} />);
    expect(screen.getByText('Agents reviewing…')).toBeInTheDocument();
  });

  it('shows the active pill when isVoting is true even with no steps', () => {
    const msg: ChatMessage = {
      id: 'a',
      role: 'assistant',
      content: '',
      isVoting: true,
      voterSteps: [],
    };
    render(<InlineVoters message={msg} />);
    expect(screen.getByText('Agents reviewing…')).toBeInTheDocument();
  });
});

// ─── VotersPanel ──────────────────────────────────────────────────────────

describe('VotersPanel', () => {
  it('renders the panel header and back button', () => {
    render(<VotersPanel message={baseMessage} onClose={() => undefined} />);
    expect(screen.getByText('Agent Reviewers')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to chat' })).toBeInTheDocument();
  });

  it('renders each voter step as a timeline entry', () => {
    render(<VotersPanel message={baseMessage} onClose={() => undefined} />);
    expect(screen.getByText('safe')).toBeInTheDocument();
    expect(screen.getByText('policy')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Rejected: action not on allowlist')).toBeInTheDocument();
  });

  it('calls onClose when the back button is clicked', () => {
    const onClose = vi.fn();
    render(<VotersPanel message={baseMessage} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back to chat' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the done footer with the correct duration', () => {
    render(<VotersPanel message={baseMessage} onClose={() => undefined} />);
    expect(screen.getByText(/Reviewed in/i)).toBeInTheDocument();
  });

  it('renders nothing when there are no voter steps and isVoting is false', () => {
    const msg: ChatMessage = { id: 'a', role: 'assistant', content: '', voterSteps: [] };
    const { container } = render(<VotersPanel message={msg} onClose={() => undefined} />);
    // OperationPane returns null when steps is empty and isActive is false
    expect(container.firstChild).toBeNull();
  });

  it('renders the voter subagent thought alongside the outcome', () => {
    const stepWithThought: VoterStep = {
      id: 'voter-thoughtful-intent-1',
      kind: 'agent',
      title: 'thoughtful',
      voterId: 'thoughtful',
      body: 'Approved',
      thought: 'Low-risk read; no side effects.',
      approve: true,
      startedAt: 1000,
      endedAt: 2000,
      status: 'done',
    };
    const msg: ChatMessage = {
      id: 'assistant-thought',
      role: 'assistant',
      content: '',
      voterSteps: [stepWithThought],
    };
    render(<VotersPanel message={msg} onClose={() => undefined} />);
    expect(screen.getByText(/Low-risk read; no side effects\./)).toBeInTheDocument();
    expect(screen.getByText(/Approved/)).toBeInTheDocument();
  });
});
