import type { WorkGraphActor, WorkGraphId } from '../core/types.js';

export type WorkGraphEventType =
  | 'workspace.created'
  | 'team.created'
  | 'project.created'
  | 'cycle.created'
  | 'label.created'
  | 'view.created'
  | 'issue.created'
  | 'issue.statusUpdated'
  | 'issue.closed'
  | 'comment.created';

export interface WorkGraphEvent<TData extends Record<string, unknown> = Record<string, unknown>> {
  id: WorkGraphId;
  type: WorkGraphEventType;
  aggregateId: WorkGraphId;
  aggregateType: string;
  actor: WorkGraphActor;
  data: TData;
  timestamp: string;
  commandId: string;
}
