import type { WorkGraphActor, WorkGraphCommand } from './types.js';

export function actorCanDispatch(actor: WorkGraphActor, command: WorkGraphCommand): boolean {
  if (actor.type === 'user' || actor.type === 'system') return true;
  return command.type === 'issue.create' || command.type === 'comment.create';
}
