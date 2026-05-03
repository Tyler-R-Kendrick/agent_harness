import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { CodexBridge } from './codexMiddleware';

function createMockProcess() {
  const process = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    stdin: { end: ReturnType<typeof vi.fn> };
    kill: ReturnType<typeof vi.fn>;
  };
  process.stdout = new PassThrough();
  process.stderr = new PassThrough();
  process.stdin = { end: vi.fn() };
  process.kill = vi.fn();
  return process;
}

describe('CodexBridge', () => {
  it('reports Codex availability from the CLI version command', async () => {
    const versionProcess = createMockProcess();
    const spawn = vi.fn(() => versionProcess as never);
    const bridge = new CodexBridge({ spawn });

    const statusPromise = bridge.getStatus();
    versionProcess.stdout.write('codex-cli 0.125.0\n');
    versionProcess.stdout.end();
    versionProcess.emit('close', 0);

    await expect(statusPromise).resolves.toMatchObject({
      available: true,
      authenticated: true,
      version: '0.125.0',
      models: [{ id: 'codex-default', name: 'Codex default' }],
      signInCommand: 'codex login',
    });
    expect(spawn).toHaveBeenCalledWith('codex', ['--version'], expect.any(Object));
  });

  it('reports Codex as unavailable when the version command fails', async () => {
    const versionProcess = createMockProcess();
    const spawn = vi.fn(() => versionProcess as never);
    const bridge = new CodexBridge({ spawn });

    const statusPromise = bridge.getStatus();
    versionProcess.stderr.write('not logged in\n');
    versionProcess.stderr.end();
    versionProcess.emit('close', 1);

    await expect(statusPromise).resolves.toMatchObject({
      available: false,
      authenticated: false,
      error: 'not logged in',
      models: [],
    });
  });

  it('streams Codex exec JSONL as Agent Browser events', async () => {
    const execProcess = createMockProcess();
    const spawn = vi.fn(() => execProcess as never);
    const bridge = new CodexBridge({ spawn });
    const events: Array<{ type: string; delta?: string; content?: string }> = [];

    const streamPromise = bridge.streamChat({
      modelId: 'codex-default',
      sessionId: 'chat-session-1',
      prompt: 'Summarize this.',
    }, new AbortController().signal, (event) => events.push(event));

    execProcess.stdout.write(`${JSON.stringify({ type: 'agent_reasoning_delta', delta: 'Inspecting workspace' })}\n`);
    execProcess.stdout.write(`${JSON.stringify({ type: 'agent_message_delta', delta: 'Codex ' })}\n`);
    execProcess.stdout.write(`${JSON.stringify({ type: 'agent_message_delta', delta: 'response' })}\n`);
    execProcess.stdout.write(`${JSON.stringify({ type: 'agent_message', message: 'Codex response' })}\n`);
    execProcess.stdout.end();
    execProcess.emit('close', 0);

    await streamPromise;

    expect(spawn).toHaveBeenCalledWith('codex', expect.arrayContaining([
      'exec',
      '--json',
      '--color',
      'never',
      '--sandbox',
      'workspace-write',
      '--ask-for-approval',
      'never',
      '-',
    ]), expect.any(Object));
    expect(execProcess.stdin.end).toHaveBeenCalledWith('Summarize this.');
    expect(events).toEqual([
      { type: 'reasoning', delta: 'Inspecting workspace' },
      { type: 'token', delta: 'Codex ' },
      { type: 'token', delta: 'response' },
      { type: 'final', content: 'Codex response' },
      { type: 'done', aborted: false },
    ]);
  });

  it('passes explicit Codex models to the CLI', async () => {
    const execProcess = createMockProcess();
    const spawn = vi.fn(() => execProcess as never);
    const bridge = new CodexBridge({ spawn });

    const streamPromise = bridge.streamChat({
      modelId: 'gpt-5.2-codex',
      sessionId: 'chat-session-1',
      prompt: 'Summarize this.',
    }, new AbortController().signal, () => undefined);

    execProcess.stdout.end();
    execProcess.emit('close', 0);
    await streamPromise;

    expect(spawn).toHaveBeenCalledWith('codex', expect.arrayContaining(['--model', 'gpt-5.2-codex']), expect.any(Object));
  });

  it('kills the Codex process when the request aborts', async () => {
    const execProcess = createMockProcess();
    const spawn = vi.fn(() => execProcess as never);
    const bridge = new CodexBridge({ spawn });
    const controller = new AbortController();

    const streamPromise = bridge.streamChat({
      modelId: 'codex-default',
      sessionId: 'chat-session-1',
      prompt: 'Summarize this.',
    }, controller.signal, () => undefined);

    controller.abort();
    execProcess.emit('close', 0);
    await streamPromise;

    expect(execProcess.kill).toHaveBeenCalled();
  });
});
