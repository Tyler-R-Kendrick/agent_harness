import type { CSSProperties, ReactNode } from 'react';

import { assertWidgetNodeAllowedByCatalog, type WidgetDocument, type WidgetNode } from './widgetComponents';

export type WidgetDocumentRendererProps = {
  document: WidgetDocument;
  sampleData?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readPath(data: unknown, path: string): unknown {
  const segments = path.split('.').filter(Boolean);
  let current = data;
  for (const segment of segments) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function stringifyResolved(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function resolveBinding(value: unknown, sampleData: unknown): string {
  if (typeof value !== 'string') return stringifyResolved(value);
  const withDoubleBraces = value.replace(/\{\{\s*([A-Za-z_$][\w.$]*)\s*\}\}/g, (_match, path: string) => (
    stringifyResolved(readPath(sampleData, path))
  ));
  return withDoubleBraces.replace(/\{([A-Za-z_$][\w.$]*)\}/g, (_match, path: string) => (
    stringifyResolved(readPath(sampleData, path))
  ));
}

function cssSize(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return `${value}px`;
  if (typeof value === 'string' && value.trim()) return value;
  return undefined;
}

function cssGap(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return `${Math.max(0, value) * 4}px`;
  return cssSize(value);
}

function cssSpacing(value: unknown): string | undefined {
  if (typeof value === 'number' || typeof value === 'string') return cssSize(value);
  if (!isRecord(value)) return undefined;
  const top = cssSize(value.top ?? value.y) ?? '0';
  const right = cssSize(value.right ?? value.x) ?? '0';
  const bottom = cssSize(value.bottom ?? value.y) ?? '0';
  const left = cssSize(value.left ?? value.x) ?? '0';
  return `${top} ${right} ${bottom} ${left}`;
}

function readActionType(node: WidgetNode): string | undefined {
  const action = node.action ?? node.onClickAction ?? node.onChangeAction ?? node.onSubmitAction;
  return isRecord(action) && typeof action.type === 'string' ? action.type : undefined;
}

function nodeStyle(node: WidgetNode): CSSProperties {
  const style: CSSProperties = {};
  const width = cssSize(node.width ?? node.size);
  const height = cssSize(node.height ?? node.size);
  const minWidth = cssSize(node.minWidth ?? node.minSize);
  const minHeight = cssSize(node.minHeight ?? node.minSize);
  const maxWidth = cssSize(node.maxWidth ?? node.maxSize);
  const maxHeight = cssSize(node.maxHeight ?? node.maxSize);
  const gap = cssGap(node.gap);
  const padding = cssSpacing(node.padding);
  const margin = cssSpacing(node.margin);
  const background = typeof node.background === 'string' ? node.background : undefined;
  const color = typeof node.color === 'string' ? node.color : undefined;

  if (width) style.width = width;
  if (height) style.height = height;
  if (minWidth) style.minWidth = minWidth;
  if (minHeight) style.minHeight = minHeight;
  if (maxWidth) style.maxWidth = maxWidth;
  if (maxHeight) style.maxHeight = maxHeight;
  if (gap) style.gap = gap;
  if (padding) style.padding = padding;
  if (margin) style.margin = margin;
  if (background) style.background = background;
  if (color) style.color = color;
  if (typeof node.flex === 'number' || typeof node.flex === 'string') style.flex = String(node.flex);
  if (typeof node.aspectRatio === 'number' || typeof node.aspectRatio === 'string') style.aspectRatio = String(node.aspectRatio);
  return style;
}

function renderChildren(node: WidgetNode, sampleData: unknown): ReactNode {
  return (node.children ?? []).map((child, index) => (
    <WidgetNodeView key={`${child.type}-${index}`} node={child} sampleData={sampleData} />
  ));
}

function WidgetNodeView({ node, sampleData }: { node: WidgetNode; sampleData: unknown }) {
  const children = renderChildren(node, sampleData);
  const style = nodeStyle(node);
  const dataProps = { 'data-design-widget': node.type };

  switch (node.type) {
    case 'Card': {
      const confirm = isRecord(node.confirm) ? node.confirm : null;
      const cancel = isRecord(node.cancel) ? node.cancel : null;
      return (
        <article
          className={`widget-doc-card widget-doc-card--${typeof node.size === 'string' ? node.size : 'md'}`}
          aria-label="Widget preview"
          style={style}
          {...dataProps}
        >
          <div className="widget-doc-card-body">{children}</div>
          {confirm || cancel ? (
            <div className="widget-doc-actions">
              {confirm ? <button type="button" data-widget-action={readActionType(confirm as WidgetNode)}>{resolveBinding(confirm.label, sampleData)}</button> : null}
              {cancel ? <button type="button" className="secondary-button" data-widget-action={readActionType(cancel as WidgetNode)}>{resolveBinding(cancel.label, sampleData)}</button> : null}
            </div>
          ) : null}
        </article>
      );
    }
    case 'Box':
    case 'Row':
    case 'Col':
      return (
        <div
          className={`widget-doc-layout widget-doc-layout--${node.type.toLowerCase()} widget-doc-layout--${typeof node.direction === 'string' ? node.direction : ''}`}
          style={style}
          {...dataProps}
        >
          {children}
        </div>
      );
    case 'Title':
      return <h3 className="widget-doc-title" style={style} {...dataProps}>{resolveBinding(node.value, sampleData)}</h3>;
    case 'Text':
      return <p className="widget-doc-text" style={style} {...dataProps}>{resolveBinding(node.value, sampleData)}</p>;
    case 'Badge':
      return <span className={`widget-doc-badge widget-doc-badge--${String(node.color ?? 'secondary')}`} style={style} {...dataProps}>{resolveBinding(node.label, sampleData)}</span>;
    case 'Button':
      return (
        <button
          type="button"
          className={`widget-doc-button widget-doc-button--${String(node.variant ?? node.style ?? 'solid')}`}
          data-widget-action={readActionType(node)}
          disabled={Boolean(node.disabled)}
          style={style}
          {...dataProps}
        >
          {resolveBinding(node.label, sampleData)}
        </button>
      );
    case 'Image':
      return (
        <img
          className="widget-doc-image"
          src={resolveBinding(node.src, sampleData)}
          alt={resolveBinding(node.alt, sampleData)}
          style={style}
          {...dataProps}
        />
      );
    case 'ListView':
      return <ul className="widget-doc-list" style={style} {...dataProps}>{children}</ul>;
    case 'ListViewItem':
      return <li className="widget-doc-list-item" style={style} {...dataProps}>{children}</li>;
    case 'Markdown':
      return <div className="widget-doc-markdown" style={style} {...dataProps}>{resolveBinding(node.value, sampleData)}</div>;
    case 'Select': {
      const options = Array.isArray(node.options) ? node.options : [];
      return (
        <select
          className="widget-doc-select"
          aria-label={resolveBinding(node.name ?? node.placeholder ?? 'Widget select', sampleData)}
          defaultValue={typeof node.defaultValue === 'string' ? node.defaultValue : undefined}
          disabled={Boolean(node.disabled)}
          style={style}
          {...dataProps}
        >
          {typeof node.placeholder === 'string' ? <option value="">{node.placeholder}</option> : null}
          {options.filter(isRecord).map((option) => (
            <option key={String(option.value ?? option.label)} value={String(option.value ?? option.label ?? '')}>
              {resolveBinding(option.label, sampleData)}
            </option>
          ))}
        </select>
      );
    }
    case 'Spacer':
      return <span className="widget-doc-spacer" style={{ minHeight: cssSize(node.minSize) ?? 8, ...style }} aria-hidden="true" {...dataProps} />;
    default:
      return <pre className="widget-doc-fallback">{JSON.stringify(node, null, 2)}</pre>;
  }
}

export function WidgetDocumentRenderer({ document, sampleData = {} }: WidgetDocumentRendererProps) {
  try {
    assertWidgetNodeAllowedByCatalog(document);
  } catch (error) {
    return (
      <article className="widget-doc-card" aria-label="Widget preview" data-design-widget="Card">
        <pre className="widget-doc-fallback">{error instanceof Error ? error.message : 'Invalid widget document'}</pre>
      </article>
    );
  }

  return <WidgetNodeView node={document} sampleData={sampleData} />;
}
