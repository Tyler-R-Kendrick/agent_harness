import type { WorkGraph } from '../commands/command-bus.js';
import type { WorkGraphActor, WorkGraphDispatchedEvent } from '../core/types.js';

export interface WorkGraphAgentIssueProposal {
  workspaceId: string;
  teamId: string;
  title: string;
  description: string;
  branchName: string;
  requestedBy: { id: string; name?: string };
  validation: string[];
}

export function createAgentIssueProposal(input: WorkGraphAgentIssueProposal): WorkGraphAgentIssueProposal {
  return {
    ...input,
    validation: [...input.validation],
  };
}

export async function applyAgentIssueProposal(
  graph: WorkGraph,
  proposal: WorkGraphAgentIssueProposal,
): Promise<WorkGraphDispatchedEvent> {
  const actor: WorkGraphActor = {
    type: 'agent',
    id: proposal.requestedBy.id,
    name: proposal.requestedBy.name,
  };
  return graph.dispatch({
    type: 'issue.create',
    actor,
    payload: {
      workspaceId: proposal.workspaceId,
      teamId: proposal.teamId,
      title: proposal.title,
      description: proposal.description,
      status: 'Proposed',
      priority: 'medium',
      metadata: {
        branchName: proposal.branchName,
        proposedByAgentId: proposal.requestedBy.id,
        validation: proposal.validation,
      },
    },
  });
}
