import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState, type ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SymphonyPanel } from './SymphonyPanel';
import { createDefaultSymphonyBoardState, type SymphonyBoardState } from '../../src/board.js';

function StatefulSymphonyPanel({
  initialBoard = createDefaultSymphonyBoardState('Melbourne Transit App'),
  onDispatchTask = vi.fn((task) => ({
    sessionId: `session-${task.identifier.toLowerCase()}`,
    sessionName: task.identifier,
    workspacePath: 'C:/src/agent-harness',
  })),
}: {
  initialBoard?: SymphonyBoardState;
  onDispatchTask?: ComponentProps<typeof SymphonyPanel>['onDispatchTask'];
}) {
  const [board, setBoard] = useState(initialBoard);
  return (
    <SymphonyPanel
      board={board}
      workspaceName="Melbourne Transit App"
      sessions={[{ id: 'session-mt-889', name: 'MT-889', isOpen: true }]}
      onBoardChange={setBoard}
      onDispatchTask={onDispatchTask}
      onOpenSession={vi.fn()}
    />
  );
}

describe('SymphonyPanel', () => {
  it('renders the Symphony board lanes, hidden columns, and active agent context', () => {
    render(<StatefulSymphonyPanel />);

    const board = screen.getByRole('region', { name: 'Symphony task board' });
    expect(board).toHaveTextContent('Backlog');
    expect(board).toHaveTextContent('Todo');
    expect(board).toHaveTextContent('In Progress');
    expect(board).toHaveTextContent('Human Review');
    expect(board).toHaveTextContent('Hidden: Rework, Merging, Done, Canceled, Duplicate');
    expect(within(board).getByText('MT-891')).toBeInTheDocument();
    expect(within(board).getAllByText('Summarize feedback from Slack channels').length).toBeGreaterThan(0);
    expect(screen.getByRole('complementary', { name: 'Symphony task inspector' })).toHaveTextContent('Task agent');
  });

  it('lets users create a task from the board toolbar', () => {
    render(<StatefulSymphonyPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Create Symphony task' }));
    fireEvent.change(screen.getByLabelText('Symphony task title'), {
      target: { value: 'Add multi-agent task manager' },
    });
    fireEvent.change(screen.getByLabelText('Symphony task brief'), {
      target: { value: 'Expose OpenAI Symphony task orchestration in Agent Browser.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Symphony task' }));

    expect(screen.getByText('MT-892')).toBeInTheDocument();
    expect(screen.getAllByText('Add multi-agent task manager').length).toBeGreaterThan(0);
    expect(screen.getByRole('complementary', { name: 'Symphony task inspector' })).toHaveTextContent('Expose OpenAI Symphony task orchestration');
  });

  it('dispatches an issue to an agent session and moves it into progress', () => {
    const onDispatchTask = vi.fn((task) => ({
      sessionId: `session-${task.identifier.toLowerCase()}`,
      sessionName: task.identifier,
      workspacePath: 'C:/src/agent-harness',
    }));
    render(<StatefulSymphonyPanel onDispatchTask={onDispatchTask} />);

    fireEvent.click(screen.getByRole('button', { name: 'MT-891 Summarize feedback from Slack channels' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dispatch agent for MT-891' }));

    expect(onDispatchTask).toHaveBeenCalledWith(expect.objectContaining({ identifier: 'MT-891' }));
    const progressLane = screen.getByRole('list', { name: 'In Progress tasks' });
    expect(within(progressLane).getByText('MT-891')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Symphony task inspector' })).toHaveTextContent('Agent running');
    expect(screen.getByRole('complementary', { name: 'Symphony task inspector' })).toHaveTextContent('session-mt-891');
  });

  it('supports review proof checks and advancing through merge completion', () => {
    render(<StatefulSymphonyPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'MT-890 Upgrade to latest React version' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dispatch agent for MT-890' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move MT-890 to Human Review' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark tests proof passing for MT-890' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move MT-890 to Merging' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move MT-890 to Done' }));

    fireEvent.click(screen.getByRole('button', { name: 'Toggle hidden Symphony lanes' }));
    const doneLane = screen.getByRole('list', { name: 'Done tasks' });
    expect(within(doneLane).getByText('MT-890')).toBeInTheDocument();
  });
});
