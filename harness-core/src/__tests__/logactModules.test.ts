import { describe, expect, it } from 'vitest';
import { PayloadType } from 'logact';
import {
  createAgentBus,
  appendMemoryMessage,
  createMemory,
  readAgentBusEntries,
  resolveAgentBus,
  resolveLogActInput,
} from '../index.js';

describe('split LogAct support modules', () => {
  it('owns AgentBus creation and preserves supplied buses', async () => {
    const defaultBus = resolveAgentBus();
    const suppliedBus = createAgentBus();

    await defaultBus.append({
      type: PayloadType.Intent,
      intentId: 'intent-1',
      action: 'answer directly',
    });

    expect(resolveAgentBus(suppliedBus)).toBe(suppliedBus);
    await expect(readAgentBusEntries(defaultBus)).resolves.toEqual([
      expect.objectContaining({
        index: 0,
        payload: expect.objectContaining({ action: 'answer directly' }),
      }),
    ]);
  });

  it('owns memory normalization and latest-input selection', () => {
    const memory = createMemory([
      { role: 'system', content: 'rules' },
      { role: 'user', content: 'older' },
    ]);
    appendMemoryMessage(memory, { role: 'assistant', content: 'answer' });

    expect(memory.messages.map((message) => message.content)).toEqual(['rules', 'older', 'answer']);
    expect(resolveLogActInput({ messages: memory.messages })).toBe('answer');
    expect(resolveLogActInput({ messages: memory.messages, input: 'explicit' })).toBe('explicit');
    expect(resolveLogActInput({ messages: [{ content: '' }, { content: '  latest  ' }] })).toBe('  latest  ');
    expect(resolveLogActInput({ messages: [{ content: 'earlier' }, { content: '' }] })).toBe('earlier');
    expect(resolveLogActInput({ messages: [{ content: '' }] })).toBe('');
    expect(resolveLogActInput({ messages: [] })).toBe('');
  });
});
