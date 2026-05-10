import type { WorkGraphIdFactory } from '../core/ids.js';
import type { WorkGraphTimeSource } from '../core/time.js';
import type { WorkGraphCommand, WorkGraphProjectionState } from '../core/types.js';
import type { WorkGraphEvent } from './types.js';

export function createWorkGraphEventFromCommand(
  command: WorkGraphCommand,
  state: WorkGraphProjectionState,
  ids: WorkGraphIdFactory,
  now: WorkGraphTimeSource,
): WorkGraphEvent {
  const timestamp = now();
  if (command.type === 'workspace.create') {
    const aggregateId = command.payload.id ?? ids.next();
    const commandId = ids.next();
    return event(command, aggregateId, 'workspace', 'workspace.created', {
      name: command.payload.name,
      key: command.payload.key ?? keyFromName(command.payload.name),
    }, timestamp, commandId);
  }
  if (command.type === 'team.create') {
    const aggregateId = command.payload.id ?? ids.next();
    const commandId = ids.next();
    return event(command, aggregateId, 'team', 'team.created', {
      workspaceId: command.payload.workspaceId,
      name: command.payload.name,
      key: command.payload.key,
      workflowStatuses: command.payload.workflowStatuses ?? ['Backlog', 'Todo', 'In Progress', 'In Review', 'Done'],
    }, timestamp, commandId);
  }
  if (command.type === 'project.create') {
    const aggregateId = command.payload.id ?? ids.next();
    const commandId = ids.next();
    return event(command, aggregateId, 'project', 'project.created', command.payload, timestamp, commandId);
  }
  if (command.type === 'cycle.create') {
    const aggregateId = command.payload.id ?? ids.next();
    const commandId = ids.next();
    return event(command, aggregateId, 'cycle', 'cycle.created', command.payload, timestamp, commandId);
  }
  if (command.type === 'label.create') {
    const aggregateId = command.payload.id ?? ids.next();
    const commandId = ids.next();
    return event(command, aggregateId, 'label', 'label.created', command.payload, timestamp, commandId);
  }
  if (command.type === 'view.create') {
    const aggregateId = command.payload.id ?? ids.next();
    const commandId = ids.next();
    return event(command, aggregateId, 'view', 'view.created', command.payload, timestamp, commandId);
  }
  if (command.type === 'issue.create') {
    const aggregateId = command.payload.id ?? ids.next();
    const commandId = ids.next();
    return event(command, aggregateId, 'issue', 'issue.created', {
      workspaceId: command.payload.workspaceId,
      teamId: command.payload.teamId,
      projectId: command.payload.projectId ?? null,
      cycleId: command.payload.cycleId ?? null,
      labelIds: command.payload.labelIds ?? [],
      title: command.payload.title,
      description: command.payload.description ?? '',
      status: command.payload.status ?? 'Backlog',
      priority: command.payload.priority ?? 'none',
      assigneeId: command.payload.assigneeId ?? null,
      metadata: command.payload.metadata ?? {},
    }, timestamp, commandId);
  }
  if (command.type === 'issue.updateStatus') {
    const commandId = ids.next();
    return event(command, command.payload.issueId, 'issue', 'issue.statusUpdated', {
      status: command.payload.status,
    }, timestamp, commandId);
  }
  if (command.type === 'issue.close') {
    const commandId = ids.next();
    return event(command, command.payload.issueId, 'issue', 'issue.closed', {
      reason: command.payload.reason,
    }, timestamp, commandId);
  }
  const commentCount = Object.values(state.comments).filter((comment) => comment.issueId === command.payload.issueId).length + 1;
  const commandId = ids.next();
  return event(command, `${command.payload.issueId}:comment-${commentCount}`, 'comment', 'comment.created', {
    issueId: command.payload.issueId,
    body: command.payload.body,
  }, timestamp, commandId);
}

function event(
  command: WorkGraphCommand,
  aggregateId: string,
  aggregateType: string,
  type: WorkGraphEvent['type'],
  data: Record<string, unknown>,
  timestamp: string,
  commandId: string,
): WorkGraphEvent {
  return {
    id: commandId,
    type,
    aggregateId,
    aggregateType,
    actor: command.actor,
    data,
    timestamp,
    commandId,
  };
}

function keyFromName(name: string): string {
  const letters = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
  return letters || 'WG';
}
