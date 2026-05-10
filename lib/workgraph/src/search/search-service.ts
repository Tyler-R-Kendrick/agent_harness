import type { WorkGraphProjectionState } from '../core/types.js';

export interface WorkGraphSearchResult {
  id: string;
  title: string;
  score: number;
}

export function searchWorkGraph(state: WorkGraphProjectionState, query: string): WorkGraphSearchResult[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return Object.values(state.issues)
    .map((issue) => {
      const labelNames = issue.labelIds.map((labelId) => state.labels[labelId]?.name ?? '').join(' ');
      const commentBodies = Object.values(state.comments)
        .filter((comment) => comment.issueId === issue.id)
        .map((comment) => comment.body)
        .join(' ');
      const haystack = [
        issue.title,
        issue.description,
        issue.status,
        issue.priority,
        labelNames,
        commentBodies,
        ...Object.values(issue.metadata).map((value) => String(value)),
      ].join(' ').toLowerCase();
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      return { id: issue.id, title: issue.title, score };
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));
}
