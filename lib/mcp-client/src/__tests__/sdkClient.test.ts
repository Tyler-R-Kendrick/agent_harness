import { afterEach, describe, expect, it } from 'vitest';

import { createDefaultMcpClient } from '../sdkClient';
import { startInMemoryMcpServer, type InMemoryMcpServer } from './inMemoryServer';

const harnesses: InMemoryMcpServer[] = [];

async function startHarness(): Promise<InMemoryMcpServer> {
  const harness = await startInMemoryMcpServer();
  harnesses.push(harness);
  return harness;
}

afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.close()));
});

describe('createDefaultMcpClient', () => {
  it('round-trips listTools/callTool/close against a real in-memory MCP server', async () => {
    const harness = await startHarness();
    const client = createDefaultMcpClient({ id: 'in-memory', transport: harness.clientTransport });

    const tools = await client.listTools();
    expect(tools).toEqual([
      expect.objectContaining({
        name: 'ping',
        description: 'Replies with pong.',
        inputSchema: expect.objectContaining({ type: 'object' }),
      }),
    ]);

    const result = await client.callTool('ping', {});
    expect(result).toMatchObject({ content: [{ type: 'text', text: 'pong' }] });

    await expect(client.close()).resolves.toBeUndefined();
  });
});
