/**
 * router.ts
 *
 * In-process A2A router. Agents register a card + handler; callers dispatch a
 * task to a skill, or `compose` a sequential chain across multiple agents.
 *
 * This is the "the caller composes multiple agent runs" pattern documented in
 * agent-browser/src/services/agentRunner.ts, expressed as a protocol surface:
 * `dispatch` never throws — unknown agents, unknown skills, and handler errors
 * are surfaced as `{ status: 'failed', error }` results.
 */

import type {
  A2AAgentCard,
  A2ARegisteredAgent,
  A2ATaskRequest,
  A2ATaskResult,
} from './types';

/** A single step in an A2A composition. */
export interface A2AComposeStep {
  agentId: string;
  request: A2ATaskRequest;
}

/** The in-process A2A router surface. */
export interface A2ARouter {
  register(agent: A2ARegisteredAgent): void;
  list(): A2AAgentCard[];
  getCard(agentId: string): A2AAgentCard | undefined;
  dispatch(agentId: string, request: A2ATaskRequest): Promise<A2ATaskResult>;
  compose(steps: A2AComposeStep[]): Promise<A2ATaskResult[]>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Create a fresh, empty in-process A2A router. */
export function createA2ARouter(): A2ARouter {
  const agents = new Map<string, A2ARegisteredAgent>();

  function register(agent: A2ARegisteredAgent): void {
    // Dedupe / replace by card id: the latest registration wins.
    agents.set(agent.card.id, agent);
  }

  function list(): A2AAgentCard[] {
    return [...agents.values()].map((agent) => agent.card);
  }

  function getCard(agentId: string): A2AAgentCard | undefined {
    return agents.get(agentId)?.card;
  }

  async function dispatch(
    agentId: string,
    request: A2ATaskRequest,
  ): Promise<A2ATaskResult> {
    const agent = agents.get(agentId);
    if (!agent) {
      return { status: 'failed', error: `Unknown agent: ${agentId}` };
    }

    const hasSkill = agent.card.skills.some((skill) => skill.id === request.skillId);
    if (!hasSkill) {
      return {
        status: 'failed',
        error: `Unknown skill "${request.skillId}" for agent "${agentId}"`,
      };
    }

    try {
      return await agent.handler(request);
    } catch (error) {
      return { status: 'failed', error: errorMessage(error) };
    }
  }

  async function compose(steps: A2AComposeStep[]): Promise<A2ATaskResult[]> {
    const results: A2ATaskResult[] = [];
    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      const result = await dispatch(step.agentId, step.request);

      if (result.status === 'failed') {
        // Stop on first failure, annotating which step broke the chain.
        const suffix = result.error === undefined ? '' : `: ${result.error}`;
        results.push({
          ...result,
          error: `A2A compose stopped at step ${index} (agent "${step.agentId}")${suffix}`,
        });
        break;
      }

      results.push(result);
    }
    return results;
  }

  return { register, list, getCard, dispatch, compose };
}
