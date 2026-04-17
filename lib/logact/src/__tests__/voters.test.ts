import { describe, it, expect } from 'vitest';
import { ClassicVoter, AllowlistVoter, LLMPassiveVoter } from '../voters.js';
import { InMemoryAgentBus } from '../agentBus.js';
import { PayloadType } from '../types.js';
import type { IntentPayload } from '../types.js';

function makeIntent(action: string): IntentPayload {
  return { type: PayloadType.Intent, intentId: 'i1', action };
}

describe('ClassicVoter', () => {
  it('approves when predicate returns true', async () => {
    const voter = new ClassicVoter('v1', () => true);
    const bus = new InMemoryAgentBus();
    const vote = await voter.vote(makeIntent('safe action'), bus);
    expect(vote.approve).toBe(true);
    expect(vote.voterId).toBe('v1');
    expect(vote.intentId).toBe('i1');
    expect(vote.type).toBe(PayloadType.Vote);
    expect(vote.reason).toBeUndefined();
  });

  it('rejects when predicate returns false', async () => {
    const voter = new ClassicVoter('v1', () => false, 'not allowed');
    const bus = new InMemoryAgentBus();
    const vote = await voter.vote(makeIntent('dangerous action'), bus);
    expect(vote.approve).toBe(false);
    expect(vote.reason).toBe('not allowed');
  });

  it('uses default reject reason when none provided', async () => {
    const voter = new ClassicVoter('v1', () => false);
    const bus = new InMemoryAgentBus();
    const vote = await voter.vote(makeIntent('x'), bus);
    expect(vote.reason).toBe('rule violation');
  });

  it('works with async predicate', async () => {
    const voter = new ClassicVoter('v1', async () => true);
    const bus = new InMemoryAgentBus();
    const vote = await voter.vote(makeIntent('async safe'), bus);
    expect(vote.approve).toBe(true);
  });

  it('exposes tier as classic', () => {
    const voter = new ClassicVoter('v1', () => true);
    expect(voter.tier).toBe('classic');
  });
});

describe('AllowlistVoter', () => {
  const voter = new AllowlistVoter('al', ['read', 'list']);

  it('approves when action matches an allowed pattern', async () => {
    const bus = new InMemoryAgentBus();
    const vote = await voter.vote(makeIntent('read file.txt'), bus);
    expect(vote.approve).toBe(true);
  });

  it('rejects when action does not match any pattern', async () => {
    const bus = new InMemoryAgentBus();
    const vote = await voter.vote(makeIntent('delete everything'), bus);
    expect(vote.approve).toBe(false);
    expect(vote.reason).toBe('action not in allowlist');
  });
});

describe('LLMPassiveVoter', () => {
  it('approves when LLM responds with APPROVE', async () => {
    const voter = new LLMPassiveVoter('llm1', async () => 'APPROVE – looks safe');
    const bus = new InMemoryAgentBus();
    const vote = await voter.vote(makeIntent('read logs'), bus);
    expect(vote.approve).toBe(true);
    expect(vote.reason).toBeUndefined();
    expect(voter.tier).toBe('llm-passive');
  });

  it('rejects when LLM responds with REJECT', async () => {
    const voter = new LLMPassiveVoter('llm1', async () => 'REJECT – unsafe');
    const bus = new InMemoryAgentBus();
    const vote = await voter.vote(makeIntent('rm -rf /'), bus);
    expect(vote.approve).toBe(false);
    expect(vote.reason).toBe('REJECT – unsafe');
  });

  it('treats any non-APPROVE response as rejection', async () => {
    const voter = new LLMPassiveVoter('llm1', async () => 'I cannot determine');
    const bus = new InMemoryAgentBus();
    const vote = await voter.vote(makeIntent('something'), bus);
    expect(vote.approve).toBe(false);
  });
});
