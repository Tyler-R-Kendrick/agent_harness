import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createDefaultHarnessAppSpec } from './harnessSpec';
import { HarnessWidgetEditorPanel } from './HarnessWidgetEditorPanel';
import type { HarnessElementPatch } from './types';

describe('HarnessWidgetEditorPanel', () => {
  it('live previews widget JSON, exposes shared components, and saves JSON patches', () => {
    const onPatchElement = vi.fn<(patch: HarnessElementPatch) => void>();
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
  });

  it('keeps invalid JSON in the editor without replacing the last valid preview', () => {
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
      />,
    );

    const editor = screen.getByRole('region', { name: 'Widget editor' });
    fireEvent.change(within(editor).getByLabelText('Widget JSON'), {
      target: { value: '{"type":"Card","children":[' },
    });

    expect(within(editor).getByRole('status')).toHaveTextContent('Widget JSON must be valid JSON');
    expect(within(editor).getByRole('article', { name: 'Widget preview' })).toBeInTheDocument();
    expect(within(editor).getByRole('button', { name: 'Save widget JSON' })).toBeDisabled();
  });
});
