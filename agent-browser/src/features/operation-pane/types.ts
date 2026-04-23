/** Status of a single step within an operation. */
export type OperationStepStatus = 'active' | 'done';
export type OperationStepLane = 'sequential' | 'parallel';

/**
 * A URL/domain reference surfaced alongside an operation step.
 * Structurally identical to `SourceChip` so reasoning chips pass through without mapping.
 */
export interface OperationSourceChip {
  domain?: string;
  url?: string;
  faviconUrl?: string;
}

/**
 * A discrete unit of work within an ongoing or completed operation.
 *
 * Structurally compatible with `ReasoningStep` — reasoning steps can be passed
 * to operation-pane components without any mapping transformation.
 */
export interface OperationStep {
  id: string;
  /** Open-ended kind string: 'thinking' | 'search' | 'tool' | 'agent' | … */
  kind: string;
  title: string;
  body?: string;
  transcript?: string;
  sources?: OperationSourceChip[];
  startedAt: number;
  endedAt?: number;
  timeoutMs?: number;
  status: OperationStepStatus;
  parentStepId?: string;
  lane?: OperationStepLane;
  /** Optional branch identifier for parallel tracks (not yet rendered). */
  branchId?: string;
}
