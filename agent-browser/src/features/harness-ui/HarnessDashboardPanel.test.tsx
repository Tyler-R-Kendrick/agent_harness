import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultHarnessAppSpec } from './harnessSpec';
import { HarnessDashboardPanel } from './HarnessDashboardPanel';

describe('HarnessDashboardPanel', () => {
  it('renders the default harness canvas with session-bound widget summaries', () => {
    const spec = createDefaultHarnessAppSpec({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
    });

    render(
      <HarnessDashboardPanel
        spec={spec}
        workspaceName="Research"
        sessions={[{
          id: 's1',
          name: 'Fix verifier',
          isOpen: true,
          messages: [
            { role: 'user', content: 'Fix the failing verifier and keep the change focused.' },
            { role: 'assistant', content: 'Added regression coverage and reran the focused tests.' },
          ],
          assets: [
            { path: 'output/playwright/agent-browser-visual-smoke.png', kind: 'file' },
          ],
        }]}
        browserPages={[{ id: 'b1', title: 'Docs', url: 'https://example.com' }]}
        files={[{ path: 'AGENTS.md', kind: 'agents' }]}
        onAddWidget={vi.fn()}
      />,
    );

    const dashboard = screen.getByRole('region', { name: 'Harness dashboard' });
    expect(within(dashboard).getByRole('heading', { name: 'Research harness' })).toBeInTheDocument();
    const conversationWidget = within(dashboard).getByRole('article', { name: 'Conversation summary widget' });
    expect(conversationWidget).toBeInTheDocument();
    expect(within(dashboard).getByRole('article', { name: 'Session storage widget' })).toBeInTheDocument();
    expect(within(conversationWidget).getByText('Session: Fix verifier')).toBeInTheDocument();
    expect(within(conversationWidget).getByText('2 messages')).toBeInTheDocument();
    expect(within(conversationWidget).getByText('Default conversation summary: 2 conversation messages across user and assistant. Last turn: assistant.')).toBeInTheDocument();
    expect(within(conversationWidget).getByText('User message 1')).toBeInTheDocument();
    expect(within(dashboard).getByText('output/playwright/agent-browser-visual-smoke.png')).toBeInTheDocument();
    expect(within(dashboard).queryByText('Page: Docs')).not.toBeInTheDocument();
    expect(within(dashboard).queryByText('File: AGENTS.md')).not.toBeInTheDocument();
    expect(within(dashboard).getByLabelText('Session for Conversation summary widget')).toHaveValue('s1');
    expect(within(dashboard).getByRole('button', { name: 'Add Widget' })).toBeInTheDocument();
    expect(dashboard.querySelector('.harness-widget-rendered .harness-widget-card')).toBeNull();
  });

  it('patches individual widget session, movement, resize, and minimized state', () => {
    const onPatchElement = vi.fn();
    const spec = createDefaultHarnessAppSpec({
      workspaceId: 'ws-build',
      workspaceName: 'Build',
    });

    render(
      <HarnessDashboardPanel
        spec={spec}
        workspaceName="Build"
        sessions={[
          { id: 's1', name: 'Session 1', isOpen: true },
          { id: 's2', name: 'Session 2', isOpen: false },
        ]}
        browserPages={[]}
        files={[]}
        onAddWidget={vi.fn()}
        onPatchElement={onPatchElement}
      />,
    );

    fireEvent.change(screen.getByLabelText('Session for Conversation summary widget'), {
      target: { value: 's2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Move Conversation summary widget right' }));
    fireEvent.click(screen.getByRole('button', { name: 'Grow Conversation summary widget' }));
    fireEvent.click(screen.getByRole('button', { name: 'Minimize Conversation summary widget' }));

    expect(onPatchElement).toHaveBeenNthCalledWith(1, {
      elementId: 'conversation-summary-widget',
      props: { sessionId: 's2' },
    });
    expect(onPatchElement).toHaveBeenNthCalledWith(2, {
      elementId: 'conversation-summary-widget',
      props: { position: { col: -6, row: -2 } },
    });
    expect(onPatchElement).toHaveBeenNthCalledWith(3, {
      elementId: 'conversation-summary-widget',
      props: { size: { cols: 6, rows: 3 } },
    });
    expect(onPatchElement).toHaveBeenNthCalledWith(4, {
      elementId: 'conversation-summary-widget',
      props: { minimized: true },
    });
  });

  it('lets users seed the add-widget prompt from suggestions and submit it', () => {
    const onAddWidget = vi.fn();
    const spec = createDefaultHarnessAppSpec({
      workspaceId: 'ws-build',
      workspaceName: 'Build',
    });

    render(
      <HarnessDashboardPanel
        spec={spec}
        workspaceName="Build"
        sessions={[]}
        browserPages={[]}
        files={[]}
        onAddWidget={onAddWidget}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create conversation summary' }));
    expect(screen.getByLabelText('Describe widget')).toHaveValue('Create conversation summary');

    fireEvent.change(screen.getByLabelText('Describe widget'), {
      target: { value: 'Show session handoff notes' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));

    expect(onAddWidget).toHaveBeenCalledWith('Show session handoff notes');
  });

  it('opens a harness inspector that can patch and regenerate app elements naturally', () => {
    const onPatchElement = vi.fn();
    const onRegenerate = vi.fn();
    const onRestoreDefault = vi.fn();
    const spec = createDefaultHarnessAppSpec({
      workspaceId: 'ws-build',
      workspaceName: 'Build',
    });

    render(
      <HarnessDashboardPanel
        spec={spec}
        workspaceName="Build"
        sessions={[]}
        browserPages={[]}
        files={[]}
        onAddWidget={vi.fn()}
        onPatchElement={onPatchElement}
        onRegenerate={onRegenerate}
        onRestoreDefault={onRestoreDefault}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    fireEvent.click(screen.getByRole('button', { name: 'Workspace tree' }));
    fireEvent.change(screen.getByLabelText('Element title'), {
      target: { value: 'Project map' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save element' }));

    expect(onPatchElement).toHaveBeenCalledWith({
      elementId: 'workspace-sidebar',
      props: { title: 'Project map' },
    });

    fireEvent.change(screen.getByLabelText('Describe app change'), {
      target: { value: 'Make the sidebar compact' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate app' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore default' }));

    expect(onRegenerate).toHaveBeenCalledWith('Make the sidebar compact');
    expect(onRestoreDefault).toHaveBeenCalledTimes(1);
  });
});
