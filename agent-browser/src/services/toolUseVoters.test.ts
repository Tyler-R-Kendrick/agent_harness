import { describe, expect, it } from 'vitest';
import { PayloadType } from 'logact';
import type { Entry, IntentPayload } from 'logact';
import {
  containsToolCall,
  createMustUseToolVoter,
  createNoPlanOnlyVoter,
  createMustExecuteCompletionChecker,
} from './toolUseVoters';

const bus = {} as never;

function intent(action: string): IntentPayload {
  return { type: PayloadType.Intent, intentId: 'i1', action };
}

function entry(payload: unknown, position = 0): Entry {
  return { position, realtimeTs: 0, payload: payload as never };
}

describe('containsToolCall', () => {
  it('detects <tool_call> blocks', () => {
    expect(containsToolCall('<tool_call>{"tool":"x","args":{}}</tool_call>')).toBe(true);
  });
  it('detects fenced JSON tool blocks', () => {
    expect(containsToolCall('```json\n{"tool":"x","args":{}}\n```')).toBe(true);
  });
  it('detects bare JSON with a tool key', () => {
    expect(containsToolCall('here: {"tool":"x","args":{}} done')).toBe(true);
  });
  it('returns false for plain prose', () => {
    expect(containsToolCall('I will think about it.')).toBe(false);
  });
});

describe('createMustUseToolVoter', () => {
  const voter = createMustUseToolVoter();

  it('approves intents with a tool call', async () => {
    const vote = await voter.vote(intent('<tool_call>{"tool":"cli","args":{}}</tool_call>'), bus);
    expect(vote.approve).toBe(true);
  });

  it('approves intents that include a prior tool result (executor follow-up turn)', async () => {
    const vote = await voter.vote(intent('Following <tool_result tool="cli">ok</tool_result> the answer is 42.'), bus);
    expect(vote.approve).toBe(true);
  });

  it('rejects naive answers without a tool call', async () => {
    const vote = await voter.vote(intent('The problem could be solved by parallelizing.'), bus);
    expect(vote.approve).toBe(false);
    expect(vote.reason).toMatch(/No tool/i);
  });
});

describe('createNoPlanOnlyVoter', () => {
  const voter = createNoPlanOnlyVoter();

  it('rejects plan-only future-tense answers', async () => {
    const vote = await voter.vote(intent("I'll write the code and let me know if you have specific constraints or requirements."), bus);
    expect(vote.approve).toBe(false);
  });

  it('approves answers that include a tool call', async () => {
    const vote = await voter.vote(intent("I'll run a tool: <tool_call>{\"tool\":\"cli\",\"args\":{}}</tool_call>"), bus);
    expect(vote.approve).toBe(true);
  });

  it('approves grounded answers without plan-only language', async () => {
    const vote = await voter.vote(intent('The result of the operation is 7.'), bus);
    expect(vote.approve).toBe(true);
  });
});

describe('createMustExecuteCompletionChecker', () => {
  const checker = createMustExecuteCompletionChecker();

  it('marks done when there is at least one non-empty Result and the answer is grounded', async () => {
    const result = await checker.check({
      task: 'do it',
      lastResult: { type: PayloadType.Result, intentId: 'i1', output: 'final answer' },
      history: [
        entry({ type: PayloadType.Result, intentId: 'i0', output: 'tool ran ok' }),
      ],
    });
    expect(result.done).toBe(true);
  });

  it('rejects when no Result with output exists in history', async () => {
    const result = await checker.check({
      task: 'do it',
      lastResult: { type: PayloadType.Result, intentId: 'i1', output: 'final answer' },
      history: [],
    });
    expect(result.done).toBe(false);
    expect(result.feedback).toMatch(/call a tool/i);
  });

  it('rejects plan-only output even when a Result exists', async () => {
    const result = await checker.check({
      task: 'do it',
      lastResult: { type: PayloadType.Result, intentId: 'i1', output: "I'll get to it shortly." },
      history: [
        entry({ type: PayloadType.Result, intentId: 'i0', output: 'tool ran ok' }),
      ],
    });
    expect(result.done).toBe(false);
  });

  it('ignores Result payloads that errored or were empty', async () => {
    const result = await checker.check({
      task: 'do it',
      lastResult: { type: PayloadType.Result, intentId: 'i1', output: 'real answer' },
      history: [
        entry({ type: PayloadType.Result, intentId: 'i0', output: '', error: 'boom' }),
        entry({ type: PayloadType.Result, intentId: 'i0', output: '   ' }),
      ],
    });
    expect(result.done).toBe(false);
  });
});
