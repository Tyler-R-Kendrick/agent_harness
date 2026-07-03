/**
 * types.ts
 *
 * Minimal Agent-to-Agent (A2A) protocol surface. Field names align with the
 * public A2A spec's `AgentCard` where reasonable while staying deliberately
 * small: this is the in-process protocol/schema layer, not a transport.
 */

/** A single capability an agent advertises on its card. */
export interface A2ASkill {
  id: string;
  name: string;
  description?: string;
}

/**
 * A minimal A2A AgentCard: the discoverable description of an agent and the
 * skills it can be dispatched to.
 */
export interface A2AAgentCard {
  id: string;
  name: string;
  description?: string;
  version: string;
  skills: A2ASkill[];
  url?: string;
}

/** A task dispatched at a single skill on an agent. */
export interface A2ATaskRequest {
  skillId: string;
  input: unknown;
  metadata?: Record<string, string>;
}

/** The terminal result of an A2A task. */
export interface A2ATaskResult {
  status: 'completed' | 'failed';
  output?: unknown;
  error?: string;
}

/** The function an agent registers to service dispatched tasks. */
export type A2AAgentHandler = (
  request: A2ATaskRequest,
) => Promise<A2ATaskResult> | A2ATaskResult;

/** An agent registered with the router: its card plus its handler. */
export interface A2ARegisteredAgent {
  card: A2AAgentCard;
  handler: A2AAgentHandler;
}
