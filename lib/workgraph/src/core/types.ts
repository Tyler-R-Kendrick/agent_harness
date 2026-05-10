export type WorkGraphId = string;

export type WorkGraphActorType = 'user' | 'agent' | 'system';

export interface WorkGraphActor {
  type: WorkGraphActorType;
  id: string;
  name?: string;
}

export type WorkGraphPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent';

export interface WorkGraphWorkspace {
  id: WorkGraphId;
  name: string;
  key: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkGraphTeam {
  id: WorkGraphId;
  workspaceId: WorkGraphId;
  name: string;
  key: string;
  workflowStatuses: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkGraphProject {
  id: WorkGraphId;
  workspaceId: WorkGraphId;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkGraphCycle {
  id: WorkGraphId;
  teamId: WorkGraphId;
  name: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkGraphLabel {
  id: WorkGraphId;
  workspaceId: WorkGraphId;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkGraphIssue {
  id: WorkGraphId;
  workspaceId: WorkGraphId;
  teamId: WorkGraphId;
  projectId: WorkGraphId | null;
  cycleId: WorkGraphId | null;
  labelIds: WorkGraphId[];
  title: string;
  description: string;
  status: string;
  priority: WorkGraphPriority;
  assigneeId: string | null;
  metadata: Record<string, unknown>;
  closedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkGraphComment {
  id: WorkGraphId;
  issueId: WorkGraphId;
  body: string;
  createdAt: string;
  updatedAt: string;
  actor: WorkGraphActor;
}

export interface WorkGraphViewQuery {
  status?: string[];
  labelIds?: WorkGraphId[];
  projectIds?: WorkGraphId[];
  cycleIds?: WorkGraphId[];
}

export interface WorkGraphView {
  id: WorkGraphId;
  workspaceId: WorkGraphId;
  name: string;
  query: WorkGraphViewQuery;
  createdAt: string;
  updatedAt: string;
}

export interface WorkGraphProjectionState {
  events: import('../events/types.js').WorkGraphEvent[];
  workspaces: Record<WorkGraphId, WorkGraphWorkspace>;
  teams: Record<WorkGraphId, WorkGraphTeam>;
  projects: Record<WorkGraphId, WorkGraphProject>;
  cycles: Record<WorkGraphId, WorkGraphCycle>;
  labels: Record<WorkGraphId, WorkGraphLabel>;
  issues: Record<WorkGraphId, WorkGraphIssue>;
  comments: Record<WorkGraphId, WorkGraphComment>;
  views: Record<WorkGraphId, WorkGraphView>;
}

export type WorkGraphCommand =
  | {
      type: 'workspace.create';
      actor: WorkGraphActor;
      payload: { id?: WorkGraphId; name: string; key?: string };
    }
  | {
      type: 'team.create';
      actor: WorkGraphActor;
      payload: { id?: WorkGraphId; workspaceId: WorkGraphId; name: string; key: string; workflowStatuses?: string[] };
    }
  | {
      type: 'project.create';
      actor: WorkGraphActor;
      payload: { id?: WorkGraphId; workspaceId: WorkGraphId; name: string };
    }
  | {
      type: 'cycle.create';
      actor: WorkGraphActor;
      payload: { id?: WorkGraphId; teamId: WorkGraphId; name: string; startsAt: string; endsAt: string };
    }
  | {
      type: 'label.create';
      actor: WorkGraphActor;
      payload: { id?: WorkGraphId; workspaceId: WorkGraphId; name: string; color: string };
    }
  | {
      type: 'view.create';
      actor: WorkGraphActor;
      payload: { id?: WorkGraphId; workspaceId: WorkGraphId; name: string; query: WorkGraphViewQuery };
    }
  | {
      type: 'issue.create';
      actor: WorkGraphActor;
      payload: {
        id?: WorkGraphId;
        workspaceId: WorkGraphId;
        teamId: WorkGraphId;
        projectId?: WorkGraphId;
        cycleId?: WorkGraphId;
        labelIds?: WorkGraphId[];
        title: string;
        description?: string;
        status?: string;
        priority?: WorkGraphPriority;
        assigneeId?: string | null;
        metadata?: Record<string, unknown>;
      };
    }
  | {
      type: 'issue.updateStatus';
      actor: WorkGraphActor;
      payload: { issueId: WorkGraphId; status: string };
    }
  | {
      type: 'issue.close';
      actor: WorkGraphActor;
      payload: { issueId: WorkGraphId; reason: string };
    }
  | {
      type: 'comment.create';
      actor: WorkGraphActor;
      payload: { issueId: WorkGraphId; body: string };
    };

export interface WorkGraphDispatchedEvent {
  id: WorkGraphId;
  aggregateId: WorkGraphId;
}
