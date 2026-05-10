import type { WorkGraphIssue, WorkGraphProjectionState } from '../core/types.js';

export function selectIssuesForView(state: WorkGraphProjectionState, viewId: string): WorkGraphIssue[] {
  const view = state.views[viewId];
  if (!view) return [];
  return Object.values(state.issues).filter((issue) => {
    if (issue.workspaceId !== view.workspaceId) return false;
    if (view.query.status?.length && !view.query.status.includes(issue.status)) return false;
    if (view.query.labelIds?.length && !view.query.labelIds.every((labelId) => issue.labelIds.includes(labelId))) return false;
    if (view.query.projectIds?.length && (!issue.projectId || !view.query.projectIds.includes(issue.projectId))) return false;
    if (view.query.cycleIds?.length && (!issue.cycleId || !view.query.cycleIds.includes(issue.cycleId))) return false;
    return true;
  });
}
