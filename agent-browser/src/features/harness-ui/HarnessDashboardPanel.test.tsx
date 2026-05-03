import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createDefaultHarnessAppSpec } from './harnessSpec';
import { HarnessDashboardPanel } from './HarnessDashboardPanel';

function createSpecWithSessionLayout() {
  const spec = createDefaultHarnessAppSpec({
    workspaceId: 'ws-research',
    workspaceName: 'Research',
  });
  spec.elements['main-dashboard'].props = {
    ...(spec.elements['main-dashboard'].props ?? {}),
    sessionWidgetLayouts: {
      s1: {
        position: { col: 0, row: 0 },
        size: { cols: 5, rows: 3 },
      },
    },
  };
  return spec;
}

describe('HarnessDashboardPanel', () => {
  it('renders only session-linked widgets on the dashboard canvas', () => {
    const onOpenSession = vi.fn();

    render(
      <HarnessDashboardPanel
        spec={createSpecWithSessionLayout()}
        workspaceName="Research"
        sessions={[
          {
            id: 's1',
            name: 'Session 1',
            messages: [
              { role: 'user', content: 'Fix the dashboard UX.' },
              { role: 'assistant', content: 'Replacing the old generated widget cards.' },
            ],
            assets: [{ path: 'output/playwright/agent-browser-visual-smoke.png', kind: 'file' }],
          },
          { id: 's2', name: 'Session 2', messages: [] },
        ]}
        browserPages={[{ id: 'b1', title: 'Docs', url: 'https://example.com' }]}
        files={[{ path: 'AGENTS.md', kind: 'agents' }]}
        onCreateSessionWidget={vi.fn()}
        onOpenSession={onOpenSession}
      />,
    );

    const dashboard = screen.getByRole('region', { name: 'Harness dashboard' });
    expect(within(dashboard).getByRole('heading', { name: 'Research harness' })).toBeInTheDocument();
    expect(within(dashboard).getByRole('article', { name: 'Session 1 widget' })).toBeInTheDocument();
    expect(within(dashboard).getByRole('article', { name: 'Session 2 widget' })).toBeInTheDocument();
    expect(within(dashboard).queryByRole('article', { name: 'Conversation summary widget' })).not.toBeInTheDocument();
    expect(within(dashboard).queryByRole('article', { name: 'Browser pages widget' })).not.toBeInTheDocument();
    expect(within(dashboard).queryByText('Page: Docs')).not.toBeInTheDocument();
    expect(within(dashboard).queryByText('File: AGENTS.md')).not.toBeInTheDocument();

    fireEvent.click(within(dashboard).getByRole('button', { name: 'Open Session 1' }));

    expect(onOpenSession).toHaveBeenCalledWith('s1');
  });

  it('creates a linked session widget instead of prompting for generated widget content', () => {
    const onCreateSessionWidget = vi.fn();

    render(
      <HarnessDashboardPanel
        spec={createSpecWithSessionLayout()}
        workspaceName="Research"
        sessions={[]}
        browserPages={[]}
        files={[]}
        onCreateSessionWidget={onCreateSessionWidget}
      />,
    );

    const dashboard = screen.getByRole('region', { name: 'Harness dashboard' });
    fireEvent.click(within(dashboard).getAllByRole('button', { name: 'New session widget' })[0]);

    expect(onCreateSessionWidget).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Describe widget')).not.toBeInTheDocument();
  });

  it('moves and resizes session widgets with pointer gestures', () => {
    const onPatchElement = vi.fn();

    render(
      <HarnessDashboardPanel
        spec={createSpecWithSessionLayout()}
        workspaceName="Research"
        sessions={[{ id: 's1', name: 'Session 1' }]}
        browserPages={[]}
        files={[]}
        onCreateSessionWidget={vi.fn()}
        onPatchElement={onPatchElement}
      />,
    );

    const card = screen.getByRole('article', { name: 'Session 1 widget' });
    const moveHandle = within(card).getByLabelText('Move Session 1 widget');
    fireEvent.pointerDown(moveHandle, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 186, clientY: 186 });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(onPatchElement).toHaveBeenCalledWith({
      elementId: 'main-dashboard',
      props: {
        sessionWidgetLayouts: {
          s1: {
            position: { col: 1, row: 1 },
            size: { cols: 5, rows: 3 },
          },
        },
      },
    });

    fireEvent.pointerDown(within(card).getByLabelText('Resize Session 1 widget'), { pointerId: 2, clientX: 400, clientY: 300 });
    fireEvent.pointerMove(window, { pointerId: 2, clientX: 482, clientY: 382 });
    fireEvent.pointerUp(window, { pointerId: 2 });

    expect(onPatchElement).toHaveBeenLastCalledWith({
      elementId: 'main-dashboard',
      props: {
        sessionWidgetLayouts: {
          s1: {
            position: { col: 0, row: 0 },
            size: { cols: 6, rows: 4 },
          },
        },
      },
    });
  });

  it('supports canvas panning, zooming, and minimap navigation', () => {
    render(
      <HarnessDashboardPanel
        spec={createSpecWithSessionLayout()}
        workspaceName="Research"
        sessions={[{ id: 's1', name: 'Session 1' }]}
        browserPages={[]}
        files={[]}
        onCreateSessionWidget={vi.fn()}
      />,
    );

    const canvas = screen.getByLabelText('Infinite session canvas');
    expect(canvas).toHaveAttribute('data-zoom', '1');

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 145, clientY: 125 });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(canvas).toHaveAttribute('data-pan-x', '45');
    expect(canvas).toHaveAttribute('data-pan-y', '25');

    fireEvent.wheel(canvas, { ctrlKey: true, deltaY: -250, clientX: 320, clientY: 240 });
    expect(Number(canvas.getAttribute('data-zoom'))).toBeGreaterThan(1);

    const minimap = screen.getByLabelText('Canvas minimap');
    fireEvent.pointerDown(minimap, { pointerId: 2, clientX: 190, clientY: 120 });

    expect(canvas.getAttribute('data-pan-x')).not.toBe('45');
  });

  it('keeps the harness inspector available for app-level customization', () => {
    const onPatchElement = vi.fn();
    const onRegenerate = vi.fn();
    const onRestoreDefault = vi.fn();

    render(
      <HarnessDashboardPanel
        spec={createSpecWithSessionLayout()}
        workspaceName="Research"
        sessions={[{ id: 's1', name: 'Session 1' }]}
        browserPages={[]}
        files={[]}
        onCreateSessionWidget={vi.fn()}
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
