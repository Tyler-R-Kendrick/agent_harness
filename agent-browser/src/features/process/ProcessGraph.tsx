import {
  Activity,
  CircleCheck,
  CircleX,
  CornerDownRight,
  FileSearch,
  Inbox,
  LoaderCircle,
  Mail,
  MessageSquare,
  Package,
  ScrollText,
  Send,
  ShieldQuestion,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { ProcessEntry, ProcessEntryKind } from '../../services/processLog';
import { branchColor } from './branchColor';

const LANE_WIDTH = 14;
const LANE_CENTER = LANE_WIDTH / 2;

const KIND_ICON: Record<ProcessEntryKind, LucideIcon> = {
  'stage-start': Sparkles,
  reasoning: MessageSquare,
  'tool-select': FileSearch,
  'tool-call': Wrench,
  'tool-result': Package,
  subagent: CornerDownRight,
  mail: Mail,
  'inf-in': Inbox,
  'inf-out': Send,
  intent: ScrollText,
  vote: ShieldQuestion,
  commit: CircleCheck,
  abort: CircleX,
  result: Package,
  completion: CircleCheck,
  policy: Activity,
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

type LaneSpan = {
  first: number;
  ownLast: number;
  last: number;
  parent?: string;
  hasActive: boolean;
};

function connectorStyle(fromIndex: number, toIndex: number, color: string, type: 'fork' | 'merge') {
  return {
    left: Math.min(fromIndex, toIndex) * LANE_WIDTH + LANE_CENTER,
    width: Math.abs(toIndex - fromIndex) * LANE_WIDTH,
    top: type === 'fork' ? '36%' : '64%',
    background: color,
  };
}

/**
 * Minimal git-graph timeline. Each entry renders as a single-row button on
 * its branch's colored rail; an active row's dot shimmers via the shared
 * `process-pill-active` keyframes.
 */
export function ProcessGraph({
  entries,
  onSelectEntry,
  selectedEntryId,
}: {
  entries: ProcessEntry[];
  onSelectEntry?: (entryId: string) => void;
  selectedEntryId?: string;
}) {
  if (!entries.length) {
    return (
      <div className="pg-empty" role="status">
        No process events captured yet.
      </div>
    );
  }

  // Pure execution-order sort: by timestamp, then by monotonic append
  // position to break ties deterministically. Branches are rendered as
  // parallel lanes (see rail layout below) so out-of-order rows are no
  // longer needed to keep branches visually grouped.
  const sorted = [...entries].sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    return a.position - b.position;
  });

  const branchOf = (entry: ProcessEntry): string => entry.branchId ?? entry.actor ?? 'main';

  // Lanes assigned in first-seen execution order so the leftmost lane is
  // whichever branch appeared first chronologically.
  const lanes: string[] = [];
  const idToLane = new Map<string, string>();
  sorted.forEach((entry) => {
    const lane = branchOf(entry);
    if (!lanes.includes(lane)) lanes.push(lane);
    idToLane.set(entry.id, lane);
  });

  // Track each lane's first/last row index so the rail can draw a vertical
  // segment spanning the lane's lifetime, plus the parent branch each lane
  // forked from (for fork/merge connectors).
  const laneSpans = new Map<string, LaneSpan>();
  sorted.forEach((entry, rowIndex) => {
    const lane = branchOf(entry);
    const parentLane = entry.parentId ? idToLane.get(entry.parentId) : undefined;
    const parent = parentLane && parentLane !== lane ? parentLane : undefined;
    const existing = laneSpans.get(lane);
    if (!existing) {
      laneSpans.set(lane, {
        first: rowIndex,
        ownLast: rowIndex,
        last: rowIndex,
        ...(parent ? { parent } : {}),
        hasActive: entry.status === 'active',
      });
    } else {
      existing.ownLast = rowIndex;
      existing.last = rowIndex;
      existing.hasActive = existing.hasActive || entry.status === 'active';
      if (!existing.parent && parent) existing.parent = parent;
    }
  });

  // A parent lane should remain visible while its child branches are running,
  // even when the parent has no row of its own between fork and merge.
  let extendedParentSpan = true;
  while (extendedParentSpan) {
    extendedParentSpan = false;
    laneSpans.forEach((span) => {
      if (!span.parent) return;
      const parentSpan = laneSpans.get(span.parent);
      if (!parentSpan) return;
      if (parentSpan.last < span.last) {
        parentSpan.last = span.last;
        extendedParentSpan = true;
      }
    });
  }

  const connectorsByRow = new Map<number, Array<{
    key: string;
    type: 'fork' | 'merge';
    laneId: string;
    fromIndex: number;
    toIndex: number;
    color: string;
  }>>();

  laneSpans.forEach((span, laneId) => {
    if (!span.parent) return;
    const fromIndex = lanes.indexOf(span.parent);
    const toIndex = lanes.indexOf(laneId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const color = branchColor(laneId);
    const fork = connectorsByRow.get(span.first) ?? [];
    fork.push({ key: `${laneId}:fork`, type: 'fork', laneId, fromIndex, toIndex, color });
    connectorsByRow.set(span.first, fork);

    if (!span.hasActive) {
      const merge = connectorsByRow.get(span.last) ?? [];
      merge.push({ key: `${laneId}:merge`, type: 'merge', laneId, fromIndex: toIndex, toIndex: fromIndex, color });
      connectorsByRow.set(span.last, merge);
    }
  });

  return (
    <div className="pg-graph" data-lane-count={lanes.length}>
      {sorted.map((entry, rowIndex) => {
        const lane = branchOf(entry);
        const laneIndex = lanes.indexOf(lane);
        const color = branchColor(lane);
        const Icon = KIND_ICON[entry.kind] ?? Activity;
        const isActive = entry.status === 'active';
        const isFailed = entry.status === 'failed';
        const isSelected = selectedEntryId === entry.id;
        const dotClassName = `pg-row-dot${isActive ? ' pg-row-dot-active' : ''}${isFailed ? ' pg-row-dot-failed' : ''}`;
        const connectors = connectorsByRow.get(rowIndex) ?? [];
        return (
          <button
            type="button"
            key={entry.id}
            className={`pg-row${isActive ? ' pg-row-active' : ''}${isFailed ? ' pg-row-failed' : ''}${isSelected ? ' pg-row-selected' : ''}`}
            data-kind={entry.kind}
            data-actor={entry.actor}
            data-branch={lane}
            data-status={entry.status}
            data-lane-index={laneIndex}
            onClick={() => onSelectEntry?.(entry.id)}
            style={{ ['--pg-branch-color' as string]: color, ['--pg-branch-index' as string]: laneIndex }}
          >
            <span className="pg-row-time" aria-hidden="true">
              {formatTime(entry.ts)}
            </span>
            <span
              className="pg-row-rail"
              aria-hidden="true"
              style={{ ['--pg-lane-count' as string]: lanes.length }}
            >
              {connectors.map((connector) => (
                <span
                  key={connector.key}
                  className={`pg-rail-connector pg-rail-${connector.type}`}
                  data-connector={connector.type}
                  data-lane={connector.laneId}
                  style={connectorStyle(connector.fromIndex, connector.toIndex, connector.color, connector.type)}
                />
              ))}
              {lanes.map((laneId, i) => {
                const span = laneSpans.get(laneId);
                if (!span) return null;
                const inSpan = rowIndex >= span.first && rowIndex <= span.last;
                const isFirst = rowIndex === span.first;
                const isLast = rowIndex === span.last && span.last === span.ownLast;
                const laneColor = branchColor(laneId);
                const isActiveLane = i === laneIndex;
                return (
                  <span
                    key={laneId}
                    className={`pg-rail-lane${inSpan ? ' pg-rail-lane-active' : ''}${isFirst ? ' pg-rail-lane-start' : ''}${isLast ? ' pg-rail-lane-end' : ''}`}
                    data-lane={laneId}
                    style={{ ['--pg-lane-color' as string]: laneColor }}
                  >
                    {isActiveLane ? (
                      <span className={dotClassName}>
                        {isActive ? (
                          <LoaderCircle size={10} className="spin pg-row-dot-spinner" aria-hidden="true" />
                        ) : null}
                        {isFailed ? (
                          <CircleX size={10} className="pg-row-dot-failed-icon" aria-hidden="true" />
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                );
              })}
            </span>
            <span className="pg-row-icon" aria-hidden="true">
              <Icon size={13} />
            </span>
            <span className="pg-row-actor">{entry.actor}</span>
            <span className="pg-row-summary">{entry.summary}</span>
          </button>
        );
      })}
    </div>
  );
}
