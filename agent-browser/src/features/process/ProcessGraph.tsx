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
  // Track each lane's first/last row index so the rail can draw a vertical
  // segment spanning the lane's lifetime, plus the parent branch each lane
  // forked from (for fork/merge connectors).
  const laneSpans = new Map<string, { first: number; last: number; parent?: string }>();
  const idToLane = new Map<string, string>();
  sorted.forEach((entry, rowIndex) => {
    const lane = branchOf(entry);
    if (!lanes.includes(lane)) lanes.push(lane);
    idToLane.set(entry.id, lane);
    const existing = laneSpans.get(lane);
    if (!existing) {
      const parentLane = entry.parentId ? idToLane.get(entry.parentId) : undefined;
      laneSpans.set(lane, { first: rowIndex, last: rowIndex, parent: parentLane && parentLane !== lane ? parentLane : undefined });
    } else {
      existing.last = rowIndex;
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
              {lanes.map((laneId, i) => {
                const span = laneSpans.get(laneId);
                if (!span) return null;
                const inSpan = rowIndex >= span.first && rowIndex <= span.last;
                const isFirst = rowIndex === span.first;
                const isLast = rowIndex === span.last;
                const laneColor = branchColor(laneId);
                const isActiveLane = i === laneIndex;
                const parentLane = span.parent;
                const parentIndex = parentLane ? lanes.indexOf(parentLane) : -1;
                // Fork connector: at this lane's first row, draw a horizontal
                // line from the parent lane to this lane.
                const isForkRow = isFirst && parentIndex >= 0 && parentIndex !== i;
                return (
                  <span
                    key={laneId}
                    className={`pg-rail-lane${inSpan ? ' pg-rail-lane-active' : ''}${isFirst ? ' pg-rail-lane-start' : ''}${isLast ? ' pg-rail-lane-end' : ''}`}
                    data-lane={laneId}
                    style={{ ['--pg-lane-color' as string]: laneColor }}
                  >
                    {isForkRow ? (
                      <span
                        className="pg-rail-fork"
                        style={{
                          ['--pg-fork-from' as string]: parentIndex,
                          ['--pg-fork-to' as string]: i,
                          ['--pg-fork-color' as string]: laneColor,
                        }}
                      />
                    ) : null}
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
