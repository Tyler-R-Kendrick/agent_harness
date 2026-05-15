import { X } from 'lucide-react';
import type { HTMLAttributes, ReactNode, SyntheticEvent } from 'react';

export type RenderPaneTitlebarProps = {
  title: ReactNode;
  closeLabel: string;
  onClose: () => void;
  actions?: ReactNode;
  className?: string;
  dragHandleProps?: HTMLAttributes<HTMLElement>;
  eyebrow?: ReactNode;
  headingClassName?: string;
};

function stopRenderPaneControlDrag(event: SyntheticEvent<HTMLElement>) {
  event.stopPropagation();
}

export const renderPaneControlProps: Pick<HTMLAttributes<HTMLElement>, 'onPointerDown' | 'onMouseDown' | 'onTouchStart'> = {
  onPointerDown: stopRenderPaneControlDrag,
  onMouseDown: stopRenderPaneControlDrag,
  onTouchStart: stopRenderPaneControlDrag,
};

export function RenderPaneTitlebar({
  title,
  closeLabel,
  onClose,
  actions,
  className,
  dragHandleProps,
  eyebrow,
  headingClassName,
}: RenderPaneTitlebarProps) {
  const headerClassName = [
    'render-pane-titlebar',
    'panel-titlebar',
    className,
    dragHandleProps ? 'panel-titlebar--draggable' : '',
  ].filter(Boolean).join(' ');
  const titlebarHeadingClassName = [
    'render-pane-titlebar-heading',
    'panel-titlebar-heading',
    headingClassName,
  ].filter(Boolean).join(' ');

  return (
    <header className={headerClassName} {...dragHandleProps}>
      <div className={titlebarHeadingClassName}>
        {eyebrow}
        {title}
      </div>
      <div className="render-pane-titlebar-actions panel-titlebar-actions">
        {actions}
        <button
          type="button"
          className="icon-button panel-close-button"
          aria-label={closeLabel}
          onClick={onClose}
          {...renderPaneControlProps}
        >
          <X size={12} />
        </button>
      </div>
    </header>
  );
}
