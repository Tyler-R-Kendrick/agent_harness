import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RenderPaneTitlebar } from './RenderPaneTitlebar';

describe('RenderPaneTitlebar', () => {
  it('renders shared pane title, actions, and close control', () => {
    const onClose = vi.fn();

    render(
      <RenderPaneTitlebar
        title={<h2>Widget editor</h2>}
        eyebrow={<span>Research</span>}
        actions={<button type="button">Save</button>}
        closeLabel="Close widget editor"
        onClose={onClose}
        className="custom-titlebar"
        headingClassName="custom-heading"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Widget editor' })).toBeInTheDocument();
    expect(screen.getByText('Research')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close widget editor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close widget editor' }).closest('header')).toHaveClass(
      'render-pane-titlebar',
      'custom-titlebar',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close widget editor' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps close controls from starting a pane drag', () => {
    const onClose = vi.fn();
    const onHeaderPointerDown = vi.fn();
    const onWrapperPointerDown = vi.fn();

    render(
      <div onPointerDown={onWrapperPointerDown}>
        <RenderPaneTitlebar
          title={<span>Dashboard</span>}
          closeLabel="Close dashboard"
          onClose={onClose}
          dragHandleProps={{
            onPointerDown: onHeaderPointerDown,
            'aria-label': 'Drag dashboard pane',
          }}
        />
      </div>,
    );

    const header = screen.getByLabelText('Drag dashboard pane');
    expect(header).toHaveClass('panel-titlebar--draggable');

    fireEvent.pointerDown(header);
    expect(onHeaderPointerDown).toHaveBeenCalledTimes(1);
    expect(onWrapperPointerDown).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Close dashboard' }));
    expect(onHeaderPointerDown).toHaveBeenCalledTimes(1);
    expect(onWrapperPointerDown).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Close dashboard' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
