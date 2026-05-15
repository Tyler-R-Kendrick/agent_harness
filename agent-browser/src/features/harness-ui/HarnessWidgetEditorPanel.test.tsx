import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createDefaultHarnessAppSpec } from './harnessSpec';
import { HarnessWidgetEditorPanel } from './HarnessWidgetEditorPanel';
import type { HarnessElementPatch } from './types';

describe('HarnessWidgetEditorPanel', () => {
  it('live previews widget JSON, exposes shared components, and saves JSON patches', () => {
    const onPatchElement = vi.fn<(patch: HarnessElementPatch) => void>();
    const onClose = vi.fn();
    const spec = createDefaultHarnessAppSpec({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
    });

    render(
      <HarnessWidgetEditorPanel
        spec={spec}
        widgetId="session-summary-widget"
        workspaceName="Research"
        files={[{ path: 'DESIGN.md', kind: 'design' }]}
        artifactCount={2}
        symphonyActive
        onPatchElement={onPatchElement}
        onOpenAssistant={vi.fn()}
        onClose={onClose}
      />,
    );

    const editor = screen.getByRole('region', { name: 'Widget editor' });
    expect(within(editor).getByRole('heading', { name: 'Session summary', level: 2 })).toBeInTheDocument();
    expect(within(editor).getByRole('button', { name: 'Card component' })).toBeInTheDocument();
    expect(within(editor).getByRole('button', { name: 'Text component' })).toBeInTheDocument();
    expect(within(editor).getByLabelText('Design system context')).toHaveTextContent('DESIGN.md');
    expect(within(editor).getByLabelText('Design system context')).toHaveTextContent('2 artifacts');
    expect(within(editor).getByLabelText('Design system context')).toHaveTextContent('Symphony active');

    fireEvent.change(within(editor).getByLabelText('Sample data'), {
      target: { value: '{ "metric": "42 checks", "owner": "Codi" }' },
    });
    fireEvent.change(within(editor).getByLabelText('Widget JSON'), {
      target: {
        value: JSON.stringify({
          type: 'Card',
          children: [
            { type: 'Title', value: '{{metric}}' },
            { type: 'Text', value: 'Owner: {{owner}}' },
          ],
        }, null, 2),
      },
    });

    expect(within(editor).getByText('42 checks')).toBeInTheDocument();
    expect(within(editor).getByText('Owner: Codi')).toBeInTheDocument();

    fireEvent.click(within(editor).getByRole('button', { name: 'Save widget JSON' }));

    expect(onPatchElement).toHaveBeenCalledWith({
      elementId: 'session-summary-widget',
      props: expect.objectContaining({
        widgetJson: expect.objectContaining({ type: 'Card' }),
        changeHistory: expect.arrayContaining([
          expect.objectContaining({ source: 'widget-editor', summary: 'Updated widget JSON' }),
        ]),
      }),
    });

    fireEvent.click(within(editor).getByRole('button', { name: 'Close widget editor' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps titlebar controls clickable without starting panel drag', () => {
    const onClose = vi.fn();
    const onOpenAssistant = vi.fn();
    const onTitlebarPointerDown = vi.fn();
    const spec = createDefaultHarnessAppSpec({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
    });
    spec.elements['session-summary-widget'] = {
      ...spec.elements['session-summary-widget'],
      props: {
        ...spec.elements['session-summary-widget'].props,
        widgetSampleData: {
          summary: 'Provided sample data',
          status: 'Ready',
          detail: 'From test',
          metric: '7 panels',
          owner: 'QA',
        },
        changeHistory: [
          null,
          { id: 'history-1', summary: 'Adjusted preview layout' },
          { id: 'history-2' },
          {},
          ['ignored'],
        ],
      },
    };

    render(
      <div onPointerDown={onTitlebarPointerDown}>
        <HarnessWidgetEditorPanel
          spec={spec}
          widgetId="session-summary-widget"
          workspaceName="Research"
          files={[]}
          artifactCount={1}
          symphonyActive={false}
          onPatchElement={vi.fn()}
          onOpenAssistant={onOpenAssistant}
          onClose={onClose}
          dragHandleProps={{ onPointerDown: vi.fn() }}
        />
      </div>,
    );

    const editor = screen.getByRole('region', { name: 'Widget editor' });
    expect(within(editor).getByLabelText('Live widget preview')).toHaveTextContent('Provided sample data');
    expect(within(editor).getByLabelText('Widget change history')).toHaveTextContent('Adjusted preview layout');
    expect(within(editor).getByLabelText('Widget change history')).toHaveTextContent('Widget update');

    fireEvent.click(within(editor).getByRole('button', { name: 'Open widget assistant' }));
    expect(onOpenAssistant).toHaveBeenCalledTimes(1);

    const closeButton = within(editor).getByRole('button', { name: 'Close widget editor' });
    fireEvent.pointerDown(closeButton);
    fireEvent.mouseDown(closeButton);
    fireEvent.touchStart(closeButton);
    fireEvent.click(closeButton);

    expect(onTitlebarPointerDown).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders a missing-widget state', () => {
    const spec = createDefaultHarnessAppSpec({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
    });

    render(
      <HarnessWidgetEditorPanel
        spec={spec}
        widgetId="missing-widget"
        workspaceName="Research"
        files={[]}
        artifactCount={0}
        symphonyActive={false}
        onPatchElement={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('region', { name: 'Widget editor' })).toHaveTextContent('Missing widget: missing-widget');
  });

  it('keeps invalid JSON in the editor without replacing the last valid preview', () => {
    const onPatchElement = vi.fn();
    const spec = createDefaultHarnessAppSpec({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
    });

    render(
      <HarnessWidgetEditorPanel
        spec={spec}
        widgetId="session-summary-widget"
        workspaceName="Research"
        files={[]}
        artifactCount={0}
        symphonyActive={false}
        onPatchElement={onPatchElement}
        onClose={vi.fn()}
      />,
    );

    const editor = screen.getByRole('region', { name: 'Widget editor' });
    fireEvent.change(within(editor).getByLabelText('Sample data'), {
      target: { value: '{"metric":' },
    });

    expect(within(editor).getByRole('status')).toHaveTextContent('Sample data must be valid JSON');
    expect(within(editor).getByRole('button', { name: 'Save widget JSON' })).toBeDisabled();
    expect(onPatchElement).not.toHaveBeenCalled();

    fireEvent.change(within(editor).getByLabelText('Sample data'), {
      target: { value: '{ "metric": "ready" }' },
    });
    expect(within(editor).getByRole('button', { name: 'Save widget JSON' })).not.toBeDisabled();

    fireEvent.change(within(editor).getByLabelText('Widget JSON'), {
      target: { value: '{"type":"Card","children":[' },
    });

    expect(within(editor).getByRole('status')).toHaveTextContent('Widget JSON must be valid JSON');
    expect(within(editor).getByRole('article', { name: 'Widget preview' })).toBeInTheDocument();
    expect(within(editor).getByRole('button', { name: 'Save widget JSON' })).toBeDisabled();
  });

  it('exposes a close action when the editor is opened as a render pane', () => {
    const onClose = vi.fn();
    const spec = createDefaultHarnessAppSpec({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
    });

    render(
      <HarnessWidgetEditorPanel
        spec={spec}
        widgetId="session-summary-widget"
        workspaceName="Research"
        files={[]}
        artifactCount={0}
        symphonyActive={false}
        onPatchElement={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close widget editor' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
