import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WidgetDocumentRenderer } from './WidgetDocumentRenderer';
import type { WidgetDocument } from './widgetComponents';

describe('WidgetDocumentRenderer', () => {
  it('renders JSON widget nodes with sample data bindings and design-system hooks', () => {
    const document: WidgetDocument = {
      type: 'Card',
      size: 'md',
      children: [
        { type: 'Row', gap: 3, children: [
          { type: 'Col', width: 84, children: [
            { type: 'Text', value: '{{date.name}}', color: 'secondary' },
            { type: 'Title', value: '{{date.number}}', size: '3xl' },
          ] },
          { type: 'Col', flex: 'auto', children: [
            { type: 'Badge', label: '{{status}}', color: 'info' },
            { type: 'Text', value: '{{event.title}}' },
          ] },
        ] },
        { type: 'Button', label: 'Add to calendar', action: { type: 'calendar.add' } },
      ],
    };

    render(
      <WidgetDocumentRenderer
        document={document}
        sampleData={{
          date: { name: 'Friday', number: '28' },
          status: 'New',
          event: { title: 'Q1 roadmap review' },
        }}
      />,
    );

    expect(screen.getByRole('article', { name: 'Widget preview' })).toHaveAttribute('data-design-widget', 'Card');
    expect(screen.getByText('Friday')).toBeInTheDocument();
    expect(screen.getByText('28')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Q1 roadmap review')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to calendar' })).toHaveAttribute('data-widget-action', 'calendar.add');
  });
});
