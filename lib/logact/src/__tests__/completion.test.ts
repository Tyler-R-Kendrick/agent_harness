import { describe, expect, it } from 'vitest';
import { LogActAgent } from '../agent.js';
import { InMemoryAgentBus } from '../agentBus.js';
import { PayloadType } from '../types.js';
import type { IExecutor, IInferenceClient } from '../types.js';

function makeInference(
  responses: string[],
  seenMessages: Array<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>>,
): IInferenceClient {
  let index = 0;
  return {
    async infer(messages) {
      seenMessages.push(messages);
      if (index >= responses.length) {
        return '';
      }
      return responses[index++];
    },
  };
}

function makeExecutor(
  fn: (action: string) => Promise<string> = async (action) => `result:${action}`,
): IExecutor {
  return {
    tier: 'llm-active',
    execute: fn,
  };
}

describe('LogActAgent – completion checker / Ralph Loop', () => {
  it('appends a Completion payload and stops when the checker marks the task done', async () => {
    const bus = new InMemoryAgentBus();
    const seenMessages: Array<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>> = [];
    const checkerCalls: string[] = [];

    const agent = new LogActAgent({
      bus,
      inferenceClient: makeInference(['draft final answer', 'should not run'], seenMessages),
      executor: makeExecutor(async () => 'completed answer'),
      completionChecker: {
        async check({ lastResult }) {
          checkerCalls.push(lastResult.output);
          return {
            type: PayloadType.Completion,
            intentId: lastResult.intentId,
            done: true,
            score: 'high',
            feedback: 'Task complete.',
          };
        },
      },
      maxTurns: 5,
    });

    await agent.send('Finish the task.');
    const results = await agent.run();

    expect(results).toHaveLength(1);
    expect(checkerCalls).toEqual(['completed answer']);
    expect(seenMessages).toHaveLength(1);

    const entries = await bus.read(0, await bus.tail());
    const completionEntries = entries.filter((entry) => entry.payload.type === PayloadType.Completion);
    expect(completionEntries).toHaveLength(1);
    expect(completionEntries[0].payload).toMatchObject({
      type: PayloadType.Completion,
      done: true,
      score: 'high',
      feedback: 'Task complete.',
    });
  });

  it('feeds checker feedback into the next turn when the task is not done yet', async () => {
    const bus = new InMemoryAgentBus();
    const seenMessages: Array<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>> = [];
    let checks = 0;

    const agent = new LogActAgent({
      bus,
      inferenceClient: makeInference(['first draft', 'second draft'], seenMessages),
      executor: makeExecutor(async (action) => `executed:${action}`),
      completionChecker: {
        async check({ lastResult }) {
          checks += 1;
          return {
            type: PayloadType.Completion,
            intentId: lastResult.intentId,
            done: checks === 2,
            score: checks === 1 ? 'med' : 'high',
            feedback: checks === 1 ? 'The task is not complete. Produce the final answer.' : 'Task complete.',
          };
        },
      },
      maxTurns: 5,
    });

    await agent.send('Complete the task.');
    const results = await agent.run();

    expect(results).toHaveLength(2);
    expect(seenMessages).toHaveLength(2);
    expect(
      seenMessages[1].some((message) =>
        message.content.includes('The task is not complete. Produce the final answer.'),
      ),
    ).toBe(true);

    const entries = await bus.read(0, await bus.tail());
    const completionEntries = entries.filter((entry) => entry.payload.type === PayloadType.Completion);
    expect(completionEntries).toHaveLength(2);
    expect(entries.some(
      (entry) => entry.payload.type === PayloadType.Mail
        && entry.payload.content.includes('The task is not complete. Produce the final answer.'),
    )).toBe(true);
  });

  it('does not enqueue blank checker feedback for another turn', async () => {
    const bus = new InMemoryAgentBus();
    const seenMessages: Array<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>> = [];

    const agent = new LogActAgent({
      bus,
      inferenceClient: makeInference(['needs review'], seenMessages),
      executor: makeExecutor(async (action) => `executed:${action}`),
      completionChecker: {
        async check({ lastResult }) {
          return {
            type: PayloadType.Completion,
            intentId: lastResult.intentId,
            done: false,
            feedback: '   ',
          };
        },
      },
      maxTurns: 2,
    });

    await agent.send('Complete the task.');
    const results = await agent.run();

    expect(results).toHaveLength(1);
    expect(seenMessages).toHaveLength(2);

    const entries = await bus.read(0, await bus.tail());
    const mailEntries = entries.filter((entry) => entry.payload.type === PayloadType.Mail);
    expect(mailEntries).toHaveLength(1);
    expect(mailEntries[0].payload).toMatchObject({
      from: 'user',
      content: 'Complete the task.',
    });
  });

  it('keeps existing single-turn behavior when no completion checker is configured', async () => {
    const bus = new InMemoryAgentBus();
    const seenMessages: Array<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>> = [];

    const agent = new LogActAgent({
      bus,
      inferenceClient: makeInference(['one shot'], seenMessages),
      executor: makeExecutor(async () => 'done'),
      maxTurns: 1,
    });

    await agent.send('Do it once.');
    const results = await agent.run();

    expect(results).toHaveLength(1);
    const entries = await bus.read(0, await bus.tail());
    expect(entries.some((entry) => entry.payload.type === PayloadType.Completion)).toBe(false);
  });

  it('does not enqueue blank checker feedback for another turn', async () => {
    const bus = new InMemoryAgentBus();

    const agent = new LogActAgent({
      bus,
      inferenceClient: makeInference(['unfinished draft', 'should not run'], []),
      executor: makeExecutor(async () => 'draft result'),
      completionChecker: {
        async check({ lastResult }) {
          return {
            type: PayloadType.Completion,
            intentId: lastResult.intentId,
            done: false,
            feedback: '   ',
          };
        },
      },
      maxTurns: 1,
    });

    await agent.send('Complete the task.');
    const results = await agent.run();

    expect(results).toHaveLength(1);
    const entries = await bus.read(0, await bus.tail());
    expect(entries.filter((entry) => entry.payload.type === PayloadType.Mail)).toHaveLength(1);
  });

  it('passes an undefined task to the checker when the history has no mail entries', async () => {
    const bus = new InMemoryAgentBus();
    let receivedTask = 'unexpected';

    await bus.append({
      type: PayloadType.Result,
      intentId: 'seed-intent',
      output: 'seed result',
    });

    const agent = new LogActAgent({
      bus,
      inferenceClient: makeInference(['follow-up action'], []),
      executor: makeExecutor(async () => 'follow-up result'),
      completionChecker: {
        async check({ task, lastResult }) {
          receivedTask = task ?? 'undefined';
          return {
            type: PayloadType.Completion,
            intentId: lastResult.intentId,
            done: true,
          };
        },
      },
      maxTurns: 1,
    });

    const results = await agent.run();

    expect(results).toHaveLength(1);
    expect(receivedTask).toBe('undefined');
  });
});
