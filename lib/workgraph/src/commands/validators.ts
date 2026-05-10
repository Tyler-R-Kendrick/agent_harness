import { z } from 'zod';
import { WorkGraphCommandError } from '../core/errors.js';
import { workGraphActorSchema, workGraphPrioritySchema } from '../core/schema.js';
import type { WorkGraphCommand } from '../core/types.js';

const nonEmpty = z.string().trim().min(1);
const viewQuerySchema = z.object({
  status: z.array(nonEmpty).optional(),
  labelIds: z.array(nonEmpty).optional(),
  projectIds: z.array(nonEmpty).optional(),
  cycleIds: z.array(nonEmpty).optional(),
});

const commandSchema: z.ZodType<WorkGraphCommand> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('workspace.create'),
    actor: workGraphActorSchema,
    payload: z.object({ id: nonEmpty.optional(), name: nonEmpty, key: nonEmpty.optional() }),
  }),
  z.object({
    type: z.literal('team.create'),
    actor: workGraphActorSchema,
    payload: z.object({
      id: nonEmpty.optional(),
      workspaceId: nonEmpty,
      name: nonEmpty,
      key: nonEmpty,
      workflowStatuses: z.array(nonEmpty).optional(),
    }),
  }),
  z.object({
    type: z.literal('project.create'),
    actor: workGraphActorSchema,
    payload: z.object({ id: nonEmpty.optional(), workspaceId: nonEmpty, name: nonEmpty }),
  }),
  z.object({
    type: z.literal('cycle.create'),
    actor: workGraphActorSchema,
    payload: z.object({ id: nonEmpty.optional(), teamId: nonEmpty, name: nonEmpty, startsAt: nonEmpty, endsAt: nonEmpty }),
  }),
  z.object({
    type: z.literal('label.create'),
    actor: workGraphActorSchema,
    payload: z.object({ id: nonEmpty.optional(), workspaceId: nonEmpty, name: nonEmpty, color: nonEmpty }),
  }),
  z.object({
    type: z.literal('view.create'),
    actor: workGraphActorSchema,
    payload: z.object({ id: nonEmpty.optional(), workspaceId: nonEmpty, name: nonEmpty, query: viewQuerySchema }),
  }),
  z.object({
    type: z.literal('issue.create'),
    actor: workGraphActorSchema,
    payload: z.object({
      id: nonEmpty.optional(),
      workspaceId: nonEmpty,
      teamId: nonEmpty,
      projectId: nonEmpty.optional(),
      cycleId: nonEmpty.optional(),
      labelIds: z.array(nonEmpty).optional(),
      title: nonEmpty,
      description: z.string().optional(),
      status: nonEmpty.optional(),
      priority: workGraphPrioritySchema.optional(),
      assigneeId: nonEmpty.nullable().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  }),
  z.object({
    type: z.literal('issue.updateStatus'),
    actor: workGraphActorSchema,
    payload: z.object({ issueId: nonEmpty, status: nonEmpty }),
  }),
  z.object({
    type: z.literal('issue.close'),
    actor: workGraphActorSchema,
    payload: z.object({ issueId: nonEmpty, reason: nonEmpty }),
  }),
  z.object({
    type: z.literal('comment.create'),
    actor: workGraphActorSchema,
    payload: z.object({ issueId: nonEmpty, body: nonEmpty }),
  }),
]);

export function validateWorkGraphCommand(command: WorkGraphCommand): WorkGraphCommand {
  const result = commandSchema.safeParse(command);
  if (!result.success) {
    throw new WorkGraphCommandError('Invalid WorkGraph command', result.error);
  }
  return result.data;
}
