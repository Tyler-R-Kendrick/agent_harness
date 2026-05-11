import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { createDefaultHarnessAppSpec } from './harnessSpec';
import { HarnessDashboardPanel } from './HarnessDashboardPanel';
import type { HarnessKnowledgeSummary } from './HarnessJsonRenderer';
import type { HarnessAppSpec, HarnessElementPatch, WidgetPosition, WidgetSize } from './types';

const knowledge: HarnessKnowledgeSummary = {
  metrics: [
    { label: 'graph nodes', value: 12, detail: '8 edges' },
    { label: 'steering', value: 2, detail: '3 files' },
  ],
  highlights: ['Latest steering: keep the canvas clean'],
};

function createSpecWithWidgetLayout(
  layouts: Record<string, { position: WidgetPosition; size: WidgetSize }> = {
    'session-summary-widget': {
      position: { col: 0, row: 0 },
      size: { cols: 5, rows: 3 },
    },
    'knowledge-widget': {
      position: { col: 8, row: 0 },
      size: { cols: 5, rows: 3 },
    },
  },
) {
  const spec = createDefaultHarnessAppSpec({
    workspaceId: 'ws-research',
    workspaceName: 'Research',
  });
  spec.elements['session-summary-widget'].props = {
    ...(spec.elements['session-summary-widget'].props ?? {}),
    ...layouts['session-summary-widget'],
  };
  spec.elements['knowledge-widget'].props = {
    ...(spec.elements['knowledge-widget'].props ?? {}),
    ...layouts['knowledge-widget'],
  };
  return spec;
}

function applyHarnessPatch(spec: HarnessAppSpec, patch: HarnessElementPatch): HarnessAppSpec {
  return {
    ...spec,
    elements: {
      ...spec.elements,
      [patch.elementId]: {
        ...spec.elements[patch.elementId],
        props: {
          ...(spec.elements[patch.elementId].props ?? {}),
          ...(patch.props ?? {}),
        },
      },
    },
  };
}

function StatefulDashboard({ onPatchElement }: { onPatchElement: (patch: HarnessElementPatch) => void }) {
  const [spec, setSpec] = useState(() => createSpecWithWidgetLayout({
    'session-summary-widget': {
      position: { col: 0, row: 0 },
      size: { cols: 5, rows: 3 },
    },
    'knowledge-widget': {
      position: { col: 8, row: 0 },
      size: { cols: 5, rows: 3 },
    },
  }));

  return (
    <HarnessDashboardPanel
      spec={spec}
      workspaceName="Research"
      sessions={[
        { id: 's1', name: 'Session 1' },
        { id: 's2', name: 'Session 2' },
      ]}
      browserPages={[]}
      files={[]}
      knowledge={knowledge}
      onCreateDashboardWidget={vi.fn()}
      onPatchElement={(patch) => {
        onPatchElement(patch);
        setSpec((current) => applyHarnessPatch(current, patch));
      }}
    />
  );
}

describe('HarnessDashboardPanel', () => {
  it('renders dashboard spec widgets through the JSON renderer instead of per-session cards', () => {
    const onOpenWidgetEditor = vi.fn();

    render(
      <HarnessDashboardPanel
        spec={createSpecWithWidgetLayout()}
        workspaceName="Research"
        sessions={[
          { id: 's1', name: 'Session 1', messages: [{ role: 'user', content: 'Fix the dashboard UX.' }] },
          { id: 's2', name: 'Session 2', messages: [] },
        ]}
        browserPages={[{ id: 'b1', title: 'Docs', url: 'https://example.com' }]}
        files={[{ path: 'AGENTS.md', kind: 'agents' }]}
        knowledge={knowledge}
        onOpenWidgetEditor={onOpenWidgetEditor}
      />,
    );

    const dashboard = screen.getByRole('region', { name: 'Harness dashboard' });
    expect(within(dashboard).getByRole('heading', { name: 'Research harness' })).toBeInTheDocument();
    expect(within(dashboard).getByRole('article', { name: 'Session summary widget' })).toBeInTheDocument();
    const knowledgeWidget = within(dashboard).getByRole('article', { name: 'Knowledge widget' });
    expect(knowledgeWidget).toBeInTheDocument();
    expect(within(knowledgeWidget).getByLabelText('Knowledge widget contents')).toHaveAttribute('tabindex', '0');
    expect(within(dashboard).getByText('Latest steering: keep the canvas clean')).toBeInTheDocument();
    expect(within(dashboard).queryByRole('article', { name: 'Session 1 widget' })).not.toBeInTheDocument();
    expect(within(dashboard).queryByRole('article', { name: 'Session 2 widget' })).not.toBeInTheDocument();

    fireEvent.click(within(dashboard).getByRole('button', { name: 'Open widget editor for Session summary' }));

    expect(onOpenWidgetEditor).toHaveBeenCalledWith('session-summary-widget');
  });

  it('does not render a separate titlebar or button strip above the infinite canvas', () => {
    render(
      <HarnessDashboardPanel
        spec={createSpecWithWidgetLayout()}
        workspaceName="Research"
        sessions={[{ id: 's1', name: 'Session 1' }]}
        browserPages={[]}
        files={[]}
        knowledge={knowledge}
        onPatchElement={vi.fn()}
      />,
    );

    const dashboard = screen.getByRole('region', { name: 'Harness dashboard' });
    const canvas = screen.getByLabelText('Infinite session canvas');

    expect(dashboard.querySelector('.harness-dashboard-titlebar')).toBeNull();
    expect(within(canvas).getByRole('heading', { name: 'Research harness' })).toBeInTheDocument();
    expect(within(canvas).queryByRole('button', { name: 'New session widget' })).not.toBeInTheDocument();
    expect(within(canvas).queryByRole('button', { name: 'Customize' })).not.toBeInTheDocument();
  });

  it('opens a right-click canvas menu for creating a bound widget session', () => {
    const onCreateDashboardWidget = vi.fn();

    render(
      <HarnessDashboardPanel
        spec={createSpecWithWidgetLayout()}
        workspaceName="Research"
        sessions={[]}
        browserPages={[]}
        files={[]}
        knowledge={knowledge}
        onCreateDashboardWidget={onCreateDashboardWidget}
      />,
    );

    const canvas = screen.getByLabelText('Infinite session canvas');
    fireEvent.contextMenu(canvas, { clientX: 220, clientY: 160 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Create widget' }));

    expect(onCreateDashboardWidget).toHaveBeenCalledWith(expect.objectContaining({
      col: expect.any(Number),
      row: expect.any(Number),
    }));
  });

  it('moves and resizes dashboard widgets by patching widget element props', () => {
    const onPatchElement = vi.fn();

    render(
      <HarnessDashboardPanel
        spec={createSpecWithWidgetLayout()}
        workspaceName="Research"
        sessions={[{ id: 's1', name: 'Session 1' }]}
        browserPages={[]}
        files={[]}
        knowledge={knowledge}
        onPatchElement={onPatchElement}
      />,
    );

    const card = screen.getByRole('article', { name: 'Session summary widget' });
    const moveHandle = within(card).getByLabelText('Move Session summary widget');
    fireEvent.pointerDown(moveHandle, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 186, clientY: 186 });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(onPatchElement).toHaveBeenCalledWith({
      elementId: 'session-summary-widget',
      props: {
        position: { col: 1, row: 1 },
        size: { cols: 5, rows: 3 },
      },
    });

    fireEvent.pointerDown(within(card).getByLabelText('Resize Session summary widget'), { pointerId: 2, clientX: 400, clientY: 300 });
    fireEvent.pointerMove(window, { pointerId: 2, clientX: 482, clientY: 382 });
    fireEvent.pointerUp(window, { pointerId: 2 });

    expect(onPatchElement).toHaveBeenLastCalledWith({
      elementId: 'session-summary-widget',
      props: {
        position: { col: 0, row: 0 },
        size: { cols: 6, rows: 4 },
      },
    });
  });

  it('moves only the dragged dashboard widget without repositioning neighboring widgets', () => {
    const onPatchElement = vi.fn();

    render(<StatefulDashboard onPatchElement={onPatchElement} />);

    const draggedCard = screen.getByRole('article', { name: 'Session summary widget' });
    const neighborCard = screen.getByRole('article', { name: 'Knowledge widget' });
    const moveHandle = within(draggedCard).getByLabelText('Move Session summary widget');

    expect(draggedCard.style.getPropertyValue('--harness-widget-col')).toBe('0');
    expect(neighborCard.style.getPropertyValue('--harness-widget-col')).toBe('8');

    fireEvent.pointerDown(moveHandle, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 592, clientY: 100 });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(draggedCard.style.getPropertyValue('--harness-widget-col')).toBe('6');
    expect(neighborCard.style.getPropertyValue('--harness-widget-col')).toBe('8');
    expect(onPatchElement).toHaveBeenLastCalledWith({
      elementId: 'session-summary-widget',
      props: {
        position: { col: 6, row: 0 },
        size: { cols: 5, rows: 3 },
      },
    });
  });

  it('supports canvas panning, zooming, and minimap navigation', () => {
    render(
      <HarnessDashboardPanel
        spec={createSpecWithWidgetLayout()}
        workspaceName="Research"
        sessions={[{ id: 's1', name: 'Session 1' }]}
        browserPages={[]}
        files={[]}
        knowledge={knowledge}
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
});
