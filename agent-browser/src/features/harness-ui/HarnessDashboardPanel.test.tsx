import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultHarnessAppSpec } from './harnessSpec';
import { HarnessDashboardPanel } from './HarnessDashboardPanel';

describe('HarnessDashboardPanel', () => {
  it('renders the default harness canvas with editable system widgets', () => {
    const spec = createDefaultHarnessAppSpec({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
    });

    render(
      <HarnessDashboardPanel
        spec={spec}
        workspaceName="Research"
        sessions={[{ id: 's1', name: 'Session 1' }]}
        browserPages={[{ id: 'b1', title: 'Docs', url: 'https://example.com' }]}
        files={[{ path: 'AGENTS.md', kind: 'agents' }]}
        onAddWidget={vi.fn()}
      />,
    );

    const dashboard = screen.getByRole('region', { name: 'Harness dashboard' });
    expect(within(dashboard).getByRole('heading', { name: 'Research harness' })).toBeInTheDocument();
    expect(within(dashboard).getByRole('article', { name: 'Workspace summary widget' })).toBeInTheDocument();
    expect(within(dashboard).getByRole('article', { name: 'Customize harness widget' })).toBeInTheDocument();
    expect(within(dashboard).getByText('1 session')).toBeInTheDocument();
    expect(within(dashboard).getByText('Page: Docs')).toBeInTheDocument();
    expect(within(dashboard).getByText('File: AGENTS.md')).toBeInTheDocument();
    expect(within(dashboard).getByRole('button', { name: 'Add Widget' })).toBeInTheDocument();
    expect(dashboard.querySelector('.harness-widget-rendered .harness-widget-card')).toBeNull();
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

    fireEvent.click(screen.getByRole('button', { name: 'Create session overview' }));
    expect(screen.getByLabelText('Describe widget')).toHaveValue('Create session overview');

    fireEvent.change(screen.getByLabelText('Describe widget'), {
      target: { value: 'Show active test and verification gates' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));

    expect(onAddWidget).toHaveBeenCalledWith('Show active test and verification gates');
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
