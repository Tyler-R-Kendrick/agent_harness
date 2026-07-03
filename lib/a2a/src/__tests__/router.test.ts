import { describe, expect, it, vi } from 'vitest';

import { createA2ARouter } from '../router';
import type {
  A2AAgentCard,
  A2AAgentHandler,
  A2ARegisteredAgent,
} from '../types';

function card(id: string, skillIds: string[]): A2AAgentCard {
  return {
    id,
    name: id,
    version: '1.0.0',
    skills: skillIds.map((skillId) => ({ id: skillId, name: skillId })),
  };
}

function agent(id: string, skillIds: string[], handler: A2AAgentHandler): A2ARegisteredAgent {
  return { card: card(id, skillIds), handler };
}

describe('createA2ARouter registration', () => {
  it('registers, lists, and looks up cards by id', () => {
    const router = createA2ARouter();
    router.register(agent('alpha', ['s1'], () => ({ status: 'completed' })));
    router.register(agent('beta', ['s2'], () => ({ status: 'completed' })));

    expect(router.list().map((c) => c.id)).toEqual(['alpha', 'beta']);
    expect(router.getCard('alpha')?.id).toBe('alpha');
    expect(router.getCard('missing')).toBeUndefined();
  });

  it('replaces an agent when re-registered under the same card id', () => {
    const router = createA2ARouter();
    router.register(agent('alpha', ['s1'], () => ({ status: 'completed', output: 'v1' })));
    router.register(agent('alpha', ['s1', 's2'], () => ({ status: 'completed', output: 'v2' })));

    expect(router.list()).toHaveLength(1);
    expect(router.getCard('alpha')?.skills.map((s) => s.id)).toEqual(['s1', 's2']);
  });
});

describe('createA2ARouter dispatch', () => {
  it('routes a task to the agent handler and returns its result', async () => {
    const router = createA2ARouter();
    router.register(
      agent('echo', ['say'], async (request) => ({ status: 'completed', output: request.input })),
    );

    const result = await router.dispatch('echo', { skillId: 'say', input: 'hello' });
    expect(result).toEqual({ status: 'completed', output: 'hello' });
  });

  it('fails when the agent is unknown', async () => {
    const router = createA2ARouter();
    const result = await router.dispatch('ghost', { skillId: 'say', input: null });
    expect(result).toEqual({ status: 'failed', error: 'Unknown agent: ghost' });
  });

  it('fails when the skill is not on the card', async () => {
    const router = createA2ARouter();
    router.register(agent('echo', ['say'], () => ({ status: 'completed' })));

    const result = await router.dispatch('echo', { skillId: 'shout', input: null });
    expect(result.status).toBe('failed');
    expect(result.error).toBe('Unknown skill "shout" for agent "echo"');
  });

  it('fails with the message when a handler throws an Error', async () => {
    const router = createA2ARouter();
    router.register(
      agent('flaky', ['go'], () => {
        throw new Error('boom');
      }),
    );

    const result = await router.dispatch('flaky', { skillId: 'go', input: null });
    expect(result).toEqual({ status: 'failed', error: 'boom' });
  });

  it('fails with a stringified value when a handler throws a non-Error', async () => {
    const router = createA2ARouter();
    router.register(
      agent('flaky', ['go'], () => {
        throw 'plain-string-failure';
      }),
    );

    const result = await router.dispatch('flaky', { skillId: 'go', input: null });
    expect(result).toEqual({ status: 'failed', error: 'plain-string-failure' });
  });
});

describe('createA2ARouter compose', () => {
  it('runs every step sequentially when all succeed', async () => {
    const router = createA2ARouter();
    router.register(
      agent('a', ['s'], (request) => ({ status: 'completed', output: `a:${request.input}` })),
    );
    router.register(
      agent('b', ['s'], (request) => ({ status: 'completed', output: `b:${request.input}` })),
    );

    const results = await router.compose([
      { agentId: 'a', request: { skillId: 's', input: 1 } },
      { agentId: 'b', request: { skillId: 's', input: 2 } },
    ]);

    expect(results).toEqual([
      { status: 'completed', output: 'a:1' },
      { status: 'completed', output: 'b:2' },
    ]);
  });

  it('stops and annotates on the first failing step', async () => {
    const router = createA2ARouter();
    const laterHandler = vi.fn(() => ({ status: 'completed' as const }));
    router.register(agent('a', ['s'], () => ({ status: 'completed', output: 'ok' })));
    router.register(agent('b', ['s'], () => ({ status: 'completed' })));
    router.register(agent('c', ['s'], laterHandler));

    const results = await router.compose([
      { agentId: 'a', request: { skillId: 's', input: null } },
      { agentId: 'b', request: { skillId: 'missing', input: null } },
      { agentId: 'c', request: { skillId: 's', input: null } },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ status: 'completed', output: 'ok' });
    expect(results[1].status).toBe('failed');
    expect(results[1].error).toBe(
      'A2A compose stopped at step 1 (agent "b"): Unknown skill "missing" for agent "b"',
    );
    expect(laterHandler).not.toHaveBeenCalled();
  });

  it('annotates a failing step whose result carries no error message', async () => {
    const router = createA2ARouter();
    router.register(agent('a', ['s'], () => ({ status: 'failed' })));

    const results = await router.compose([{ agentId: 'a', request: { skillId: 's', input: null } }]);

    expect(results).toHaveLength(1);
    expect(results[0].error).toBe('A2A compose stopped at step 0 (agent "a")');
  });
});
