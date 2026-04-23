import { ArrowLeft, ChevronDown } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import type { OperationSourceChip, OperationStep } from './types';

// ─── Favicon helper ────────────────────────────────────────────────────────

function resolveChipFavicon(source: OperationSourceChip): string | undefined {
  if (source.faviconUrl) return source.faviconUrl;
  const base = source.url ?? (source.domain ? `https://${source.domain}` : undefined);
  if (!base) return undefined;
  try {
    const { hostname } = new URL(base.startsWith('http') ? base : `https://${base}`);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return undefined;
  }
}

// ─── Source chips ──────────────────────────────────────────────────────────

function SourceRow({ sources }: { sources?: OperationSourceChip[] }) {
  if (!sources?.length) return null;
  const visible = sources.slice(0, 2);
  const hidden = sources.length - visible.length;
  return (
    <div className="op-source-row">
      {visible.map((s, i) => {
        const favicon = resolveChipFavicon(s);
        return (
          <span key={`${s.domain ?? ''}-${s.url ?? i}`} className="op-source-chip">
            {favicon ? <img src={favicon} alt="" aria-hidden="true" width="14" height="14" /> : null}
            <span>{s.domain}</span>
          </span>
        );
      })}
      {hidden > 0 ? (
        <span className="op-source-chip op-source-chip-more">{hidden} more</span>
      ) : null}
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────

/**
 * Renders an ordered step graph (git-graph style vertical timeline) for any
 * operation. Steps are shown in order with their title, body, and source chips.
 */
export function OperationTimeline({
  steps,
  onSelectStep,
}: {
  steps: OperationStep[];
  onSelectStep?: (stepId: string) => void;
}) {
  return (
    <div className="op-timeline">
      {steps.map((step) => (
        <div key={step.id} className={`op-timeline-item op-timeline-item-${step.status}`}>
          <span className="op-timeline-rail" aria-hidden="true" />
          <span className="op-timeline-dot" aria-hidden="true" />
          <div
            className={`op-timeline-content${onSelectStep ? ' op-timeline-content-selectable' : ''}`}
            role={onSelectStep ? 'button' : undefined}
            tabIndex={onSelectStep ? 0 : undefined}
            onClick={onSelectStep ? () => onSelectStep(step.id) : undefined}
            onKeyDown={onSelectStep ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelectStep(step.id);
              }
            } : undefined}
          >
            <div className="op-timeline-title-row">
              <strong>{step.title}</strong>
              <StepCounter step={step} />
              {onSelectStep ? <span className="op-step-inspect-label">Inspect</span> : null}
            </div>
            <SourceRow sources={step.sources} />
            {step.body ? <p>{step.body}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

type OperationGraphNode = OperationStep & {
  children: OperationGraphNode[];
};

function buildOperationGraph(steps: OperationStep[]): OperationGraphNode[] {
  const nodes = new Map<string, OperationGraphNode>();
  const roots: OperationGraphNode[] = [];

  steps.forEach((step) => {
    nodes.set(step.id, { ...step, children: [] });
  });

  steps.forEach((step) => {
    const node = nodes.get(step.id);
    if (!node) return;
    if (step.parentStepId && nodes.has(step.parentStepId)) {
      nodes.get(step.parentStepId)?.children.push(node);
      return;
    }
    roots.push(node);
  });

  const sortNodes = (items: OperationGraphNode[]) => {
    items.sort((left, right) => {
      if (left.startedAt !== right.startedAt) return left.startedAt - right.startedAt;
      return left.title.localeCompare(right.title);
    });
    items.forEach((item) => sortNodes(item.children));
  };
  sortNodes(roots);

  return roots;
}

function describeStepRole(step: OperationStep, isRoot: boolean): string {
  if (isRoot) return 'Coordinator';
  if (step.lane === 'parallel') return 'Parallel track';
  if (/agentbus|reviewer votes/i.test(step.title)) return 'Process mirror';
  return 'Sequential step';
}

function OperationGraphNodeCard({
  step,
  isRoot,
  onSelectStep,
}: {
  step: OperationStep;
  isRoot: boolean;
  onSelectStep?: (stepId: string) => void;
}) {
  const roleLabel = describeStepRole(step, isRoot);
  const isMirror = roleLabel === 'Process mirror';

  return (
    <button
      type="button"
      className={`op-graph-node op-graph-node-${step.status}${step.status === 'active' ? ' op-graph-node-active' : ''}${isRoot ? ' op-graph-node-root' : ''}${isMirror ? ' op-graph-node-mirror' : ''}`}
      onClick={onSelectStep ? () => onSelectStep(step.id) : undefined}
    >
      <div className="op-graph-node-header">
        <span className="op-graph-node-dot" aria-hidden="true" />
        <strong>{step.title}</strong>
        <StepCounter step={step} />
        {onSelectStep ? <span className="op-step-inspect-label">Inspect</span> : null}
      </div>
      <div className="op-graph-node-meta">
        <span className={`op-step-role-pill${isRoot ? ' op-step-role-pill-root' : ''}${isMirror ? ' op-step-role-pill-mirror' : ''}`}>{roleLabel}</span>
        <span className={`op-step-status-pill op-step-status-pill-${step.status}`}>{step.status === 'active' ? 'Running' : 'Complete'}</span>
      </div>
      {step.body ? <p>{step.body}</p> : null}
    </button>
  );
}

function renderOperationGraphNode(
  node: OperationGraphNode,
  depth: number,
  onSelectStep?: (stepId: string) => void,
): ReactNode {
  const hasParallelChildren = node.children.length > 1 && node.children.every((child) => child.lane === 'parallel');
  const isRoot = depth === 0;

  return (
    <div key={node.id} className={`op-graph-branch${isRoot ? ' op-graph-branch-root' : ''}`}>
      <OperationGraphNodeCard step={node} isRoot={isRoot} onSelectStep={onSelectStep} />
      {node.children.length ? (
        <div className={`op-graph-children ${hasParallelChildren ? 'op-graph-children-parallel' : 'op-graph-children-sequential'}`}>
          {node.children.map((child) => renderOperationGraphNode(child, depth + 1, onSelectStep))}
        </div>
      ) : null}
    </div>
  );
}

export function OperationGraph({
  steps,
  onSelectStep,
}: {
  steps: OperationStep[];
  onSelectStep?: (stepId: string) => void;
}) {
  const roots = buildOperationGraph(steps);

  return (
    <div className="op-graph">
      {roots.map((root) => renderOperationGraphNode(root, 0, onSelectStep))}
    </div>
  );
}

// ─── Duration formatting ───────────────────────────────────────────────────

/** Formats a total-seconds value as a human-readable duration string. */
export function formatOperationDuration(totalSeconds?: number): string {
  const s = Math.max(0, totalSeconds ?? 0);
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r ? `${m}m ${r}s` : `${m}m`;
  }
  return `${s}s`;
}

// ─── Live duration hook ────────────────────────────────────────────────────

function useLiveDuration(startedAt?: number, fallback?: number, active?: boolean): number | undefined {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active || !startedAt) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active, startedAt]);

  if (active && startedAt) return Math.max(1, Math.round((now - startedAt) / 1000));
  return fallback;
}

function getStepDurationSeconds(step: OperationStep): number | undefined {
  if (!step.endedAt) return undefined;
  return Math.max(1, Math.round((step.endedAt - step.startedAt) / 1000));
}

function StepCounter({ step }: { step: OperationStep }) {
  const elapsed = useLiveDuration(step.startedAt, getStepDurationSeconds(step), step.status === 'active');
  if (!elapsed) return null;

  const timeoutSeconds = step.timeoutMs ? Math.max(1, Math.round(step.timeoutMs / 1000)) : undefined;
  const elapsedLabel = formatOperationDuration(elapsed);
  const budgetLabel = timeoutSeconds ? formatOperationDuration(timeoutSeconds) : undefined;
  const ariaLabel = budgetLabel
    ? `Step timer elapsed ${elapsedLabel}, budget ${budgetLabel}`
    : `Step timer elapsed ${elapsedLabel}`;

  return (
    <span
      className={`op-step-counter${timeoutSeconds && elapsed > timeoutSeconds ? ' op-step-counter-overdue' : ''}`}
      aria-label={ariaLabel}
    >
      <span className="op-step-counter-label">Elapsed</span>
      <span className="op-step-counter-value">{elapsedLabel}</span>
      {budgetLabel ? <span className="op-step-counter-divider" aria-hidden="true">/</span> : null}
      {budgetLabel ? <span className="op-step-counter-label">Budget</span> : null}
      {budgetLabel ? <span className="op-step-counter-value">{budgetLabel}</span> : null}
    </span>
  );
}

// ─── OperationTrigger (inline pill) ───────────────────────────────────────

export interface OperationTriggerProps {
  isActive: boolean;
  durationSeconds?: number;
  /** Label shown while the operation is active. Default: "Working…" */
  activeLabel?: string;
  /** Prefix for the completed label. Default: "Done in" */
  doneLabelPrefix?: string;
  /** Icon shown in the active-state button. */
  activeIcon?: ReactNode;
  /** Icon shown in the done-state button. */
  doneIcon?: ReactNode;
  /** Extra CSS class applied to the active-state button (e.g. for shimmer animations). */
  activeClassName?: string;
  /** Called when the user clicks the trigger in either state. */
  onOpen?: () => void;
}

/**
 * A minimal inline button that surfaces an operation's status in the chat
 * transcript. Looks like plain text by default; reveals button chrome on hover.
 *
 * - While active: shows `activeLabel` with an optional spinner icon.
 * - When done: shows `doneLabelPrefix + duration` with a chevron.
 * - Clicking either state calls `onOpen` (e.g. to open the full OperationPane).
 */
export function OperationTrigger({
  isActive,
  durationSeconds,
  activeLabel = 'Working…',
  doneLabelPrefix = 'Done in',
  activeIcon,
  doneIcon,
  activeClassName,
  onOpen,
}: OperationTriggerProps) {
  if (isActive) {
    return (
      <div className="op-trigger-block">
        <button
          type="button"
          className={`op-trigger op-trigger-active${activeClassName ? ` ${activeClassName}` : ''}`}
          onClick={onOpen}
        >
          {activeIcon ?? null}
          <span>{activeLabel}</span>
        </button>
      </div>
    );
  }

  if (!durationSeconds) return null;

  return (
    <div className="op-trigger-block">
      <button
        type="button"
        className="op-trigger"
        aria-label={`${doneLabelPrefix} ${formatOperationDuration(durationSeconds)}`}
        onClick={onOpen}
      >
        {doneIcon ?? null}
        <span>
          {doneLabelPrefix} {formatOperationDuration(durationSeconds)}
        </span>
        <ChevronDown size={12} className="op-trigger-chevron" />
      </button>
    </div>
  );
}

// ─── OperationPane (full-view overlay) ────────────────────────────────────

export interface OperationPaneProps {
  steps: OperationStep[];
  view?: 'timeline' | 'graph';
  /** Heading displayed in the overlay header. Default: "Activity" */
  title?: string;
  /** `aria-label` for the `<aside>`. Defaults to `title`. */
  ariaLabel?: string;
  /** Aria label for the back/close button. Default: "Back" */
  backLabel?: string;
  /** Whether the operation is still running (drives live elapsed timer; hides footer). */
  isActive?: boolean;
  /** Timestamp (ms) when the operation started — drives the live elapsed timer. */
  startedAt?: number;
  /** Completed duration in seconds — shown in the footer when done. */
  durationSeconds?: number;
  /**
   * Custom footer content. When omitted, a default "duration · Done" footer
   * renders automatically once the operation completes.
   */
  footer?: ReactNode;
  onSelectStep?: (stepId: string) => void;
  /** Called when the user dismisses the pane. */
  onClose: () => void;
}

/**
 * An absolute-positioned full-pane overlay that renders an operation's step
 * graph (via OperationTimeline) with a header and optional footer.
 *
 * Mount it inside a `position: relative` container — it covers the full area.
 *
 * Currently used for the reasoning/thought inspection view. Future use:
 * subagent work delegation, tool execution traces, and any context that
 * produces a step graph outside the main chat flow but needs to return a
 * summarized result into it.
 */
export function OperationPane({
  steps,
  view = 'timeline',
  title = 'Activity',
  ariaLabel,
  backLabel = 'Back',
  isActive,
  startedAt,
  durationSeconds,
  footer,
  onSelectStep,
  onClose,
}: OperationPaneProps) {
  const elapsed = useLiveDuration(startedAt, durationSeconds, isActive);

  if (!steps.length && !isActive) return null;

  const resolvedFooter = footer !== undefined ? footer : (
    (!isActive && durationSeconds) ? (
      <footer className="op-pane-footer">
        <span>{formatOperationDuration(durationSeconds)}</span>
        <span>Done</span>
      </footer>
    ) : null
  );

  return (
    <aside className="op-pane" aria-label={ariaLabel ?? title}>
      <header className="op-pane-header">
        <button type="button" className="op-pane-back" aria-label={backLabel} onClick={onClose}>
          <ArrowLeft size={16} />
        </button>
        <div className="op-pane-title">{title}</div>
        {elapsed ? <span className="op-pane-duration">{formatOperationDuration(elapsed)}</span> : null}
      </header>
      <div className="op-pane-body">
        {view === 'graph'
          ? <OperationGraph steps={steps} onSelectStep={onSelectStep} />
          : <OperationTimeline steps={steps} onSelectStep={onSelectStep} />}
      </div>
      {resolvedFooter}
    </aside>
  );
}

