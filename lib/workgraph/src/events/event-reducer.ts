import type {
  WorkGraphComment,
  WorkGraphCycle,
  WorkGraphIssue,
  WorkGraphLabel,
  WorkGraphProjectionState,
  WorkGraphProject,
  WorkGraphTeam,
  WorkGraphView,
  WorkGraphWorkspace,
} from '../core/types.js';
import type { WorkGraphEvent } from './types.js';

export function reduceWorkGraphEvents(events: WorkGraphEvent[]): WorkGraphProjectionState {
  const state: WorkGraphProjectionState = {
    events: [...events],
    workspaces: {},
    teams: {},
    projects: {},
    cycles: {},
    labels: {},
    issues: {},
    comments: {},
    views: {},
  };

  for (const event of events) {
    if (event.type === 'workspace.created') {
      state.workspaces[event.aggregateId] = {
        id: event.aggregateId,
        name: stringValue(event.data.name),
        key: stringValue(event.data.key),
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
      };
    } else if (event.type === 'team.created') {
      state.teams[event.aggregateId] = {
        id: event.aggregateId,
        workspaceId: stringValue(event.data.workspaceId),
        name: stringValue(event.data.name),
        key: stringValue(event.data.key),
        workflowStatuses: stringArrayValue(event.data.workflowStatuses),
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
      };
    } else if (event.type === 'project.created') {
      state.projects[event.aggregateId] = {
        id: event.aggregateId,
        workspaceId: stringValue(event.data.workspaceId),
        name: stringValue(event.data.name),
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
      };
    } else if (event.type === 'cycle.created') {
      state.cycles[event.aggregateId] = {
        id: event.aggregateId,
        teamId: stringValue(event.data.teamId),
        name: stringValue(event.data.name),
        startsAt: stringValue(event.data.startsAt),
        endsAt: stringValue(event.data.endsAt),
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
      };
    } else if (event.type === 'label.created') {
      state.labels[event.aggregateId] = {
        id: event.aggregateId,
        workspaceId: stringValue(event.data.workspaceId),
        name: stringValue(event.data.name),
        color: stringValue(event.data.color),
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
      };
    } else if (event.type === 'view.created') {
      state.views[event.aggregateId] = {
        id: event.aggregateId,
        workspaceId: stringValue(event.data.workspaceId),
        name: stringValue(event.data.name),
        query: objectValue(event.data.query) as WorkGraphView['query'],
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
      };
    } else if (event.type === 'issue.created') {
      state.issues[event.aggregateId] = {
        id: event.aggregateId,
        workspaceId: stringValue(event.data.workspaceId),
        teamId: stringValue(event.data.teamId),
        projectId: nullableStringValue(event.data.projectId),
        cycleId: nullableStringValue(event.data.cycleId),
        labelIds: stringArrayValue(event.data.labelIds),
        title: stringValue(event.data.title),
        description: stringValue(event.data.description),
        status: stringValue(event.data.status),
        priority: stringValue(event.data.priority) as WorkGraphIssue['priority'],
        assigneeId: nullableStringValue(event.data.assigneeId),
        metadata: objectValue(event.data.metadata),
        closedReason: null,
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
      };
    } else if (event.type === 'issue.statusUpdated') {
      const issue = state.issues[event.aggregateId];
      if (issue) {
        state.issues[event.aggregateId] = {
          ...issue,
          status: stringValue(event.data.status),
          updatedAt: event.timestamp,
        };
      }
    } else if (event.type === 'issue.closed') {
      const issue = state.issues[event.aggregateId];
      if (issue) {
        state.issues[event.aggregateId] = {
          ...issue,
          status: 'Closed',
          closedReason: stringValue(event.data.reason),
          updatedAt: event.timestamp,
        };
      }
    } else if (event.type === 'comment.created') {
      state.comments[event.aggregateId] = {
        id: event.aggregateId,
        issueId: stringValue(event.data.issueId),
        body: stringValue(event.data.body),
        actor: event.actor,
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
      };
    }
  }

  return deepFreeze(state);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function nullableStringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? { ...value } : {};
}

export function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const property of Object.values(value)) {
    deepFreeze(property);
  }
  return Object.freeze(value);
}

export type {
  WorkGraphWorkspace,
  WorkGraphTeam,
  WorkGraphProject,
  WorkGraphCycle,
  WorkGraphLabel,
  WorkGraphIssue,
  WorkGraphComment,
};
