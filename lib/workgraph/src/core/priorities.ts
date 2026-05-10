import type { WorkGraphIssue, WorkGraphPriority } from './types.js';

const PRIORITY_ORDER: Record<WorkGraphPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

export function priorityRank(priority: WorkGraphPriority): number {
  return PRIORITY_ORDER[priority];
}

export function sortIssuesByPriority(issues: WorkGraphIssue[]): WorkGraphIssue[] {
  return [...issues].sort((left, right) => priorityRank(left.priority) - priorityRank(right.priority)
    || left.createdAt.localeCompare(right.createdAt)
    || left.id.localeCompare(right.id));
}
