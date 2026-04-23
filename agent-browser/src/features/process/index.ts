/**
 * The `process` feature implements the unified ProcessLog visualization:
 *   - InlineProcess: single chat-row pill summarising the turn's process.
 *   - ProcessGraph: minimal git-graph timeline drawn entirely in CSS.
 *   - ProcessDrilldown: per-row detail view showing transcript + payload.
 */
export { InlineProcess } from './InlineProcess';
export { ProcessGraph } from './ProcessGraph';
export { ProcessDrilldown } from './ProcessDrilldown';
export { ProcessPanel } from './ProcessPanel';
export { branchColor } from './branchColor';
