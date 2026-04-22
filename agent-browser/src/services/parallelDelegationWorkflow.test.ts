import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../chat-agents/agent-loop', async () => {
  const actual = await vi.importActual<typeof import('../chat-agents/agent-loop')>('../chat-agents/agent-loop');
  return {
    ...actual,
    runAgentLoop: vi.fn(actual.runAgentLoop),
  };
});

import { runAgentLoop } from '../chat-agents/agent-loop';
import {
  buildDelegationProblemBrief,
  buildSectionedDelegationPrompt,
  createDelegationSectionRouter,
  DELEGATION_SECTION_MARKERS,
  isParallelDelegationPrompt,
  runParallelDelegationWorkflow,
} from './parallelDelegationWorkflow';

function makeStreamingModel(responses: Record<string, string>) {
  return {
    doStream: vi.fn(async ({ prompt }) => {
      const system = prompt[0]?.content as string;
      const response = Object.entries(responses).find(([marker]) => system.includes(marker))?.[1] ?? 'fallback';

      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'text-start', id: 'text-0' });
            controller.enqueue({ type: 'text-delta', id: 'text-0', delta: response });
            controller.enqueue({ type: 'text-end', id: 'text-0' });
            controller.enqueue({
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: {
                inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 0, text: 0, reasoning: 0 },
              },
            });
            controller.close();
          },
        }),
      };
    }),
  };
}

describe('parallelDelegationWorkflow', () => {
  beforeEach(() => {
    vi.mocked(runAgentLoop).mockClear();
  });

  it('detects delegation prompts via keyword combinations', () => {
    expect(isParallelDelegationPrompt('parallelize this and delegate it to subagents')).toBe(true);
    expect(isParallelDelegationPrompt('Identify a multi-step problem suitable for parallelization, break it into independent tasks, and delegate each to subagents for concurrent execution.')).toBe(true);
    expect(isParallelDelegationPrompt('delegate this')).toBe(false);
  });

  it('builds a compact coordinator brief', () => {
    expect(buildDelegationProblemBrief('parallelize the work', 'Research')).toContain('Active workspace: Research');
  });

  it('builds a sectioned local delegation prompt contract', () => {
    const prompt = buildSectionedDelegationPrompt('Research');

    expect(prompt).toContain(DELEGATION_SECTION_MARKERS.problem);
    expect(prompt).toContain(DELEGATION_SECTION_MARKERS.breakdown);
    expect(prompt).toContain(DELEGATION_SECTION_MARKERS.assignment);
    expect(prompt).toContain(DELEGATION_SECTION_MARKERS.validation);
    expect(prompt).toContain('Do not repeat the same bullets across sections.');
  });

  it('routes sectioned deltas to distinct buffers even when markers split across chunks', () => {
    const seen: Record<string, string> = {
      problem: '',
      breakdown: '',
      assignment: '',
      validation: '',
    };
    const router = createDelegationSectionRouter((section, delta) => {
      seen[section] += delta;
    });

    router.push('===PRO');
    router.push('BLEM===\nAudit TODO drift.\n===BREAK');
    router.push('DOWN===\n- Inspect src\n- Inspect tests\n===ASSIGNMENT===\n');
    router.push('- Reader: inspect src\n===VALIDATION===\n- Confirm no overlap');

    const finished = router.finish();

    expect(finished.problem.trim()).toBe('Audit TODO drift.');
    expect(finished.breakdown).toContain('Inspect src');
    expect(finished.assignment).toContain('Reader: inspect src');
    expect(finished.validation).toContain('Confirm no overlap');
    expect(finished.breakdown).not.toContain('Reader: inspect src');
    expect(finished.assignment).not.toContain('Confirm no overlap');
  });

  it('runs three compact worker prompts in parallel and synthesizes the final report', async () => {
    const model = makeStreamingModel({
      'delegation-worker:coordinator': 'Audit TODO coverage in src without broad scans.',
      'delegation-worker:sectioned-plan': '===PROBLEM===\nAudit TODO coverage in src without broad scans.\n===BREAKDOWN===\n- Task A\n- Task B\n===ASSIGNMENT===\n- Agent 1: Task A\n- Agent 2: Task B\n===VALIDATION===\n- Risk: drift\n- Check: compare outputs',
    });
    const onStepStart = vi.fn();
    const onStepToken = vi.fn();
    const onStepComplete = vi.fn();
    const onDone = vi.fn();

    const result = await runParallelDelegationWorkflow({
      model: model as never,
      prompt: 'figure out a multi-step problem to solve that can be parallelized; parallelize it and delegate the work to subagents.',
      workspaceName: 'Research',
      capabilities: { provider: 'copilot', contextWindow: 2048, maxOutputTokens: 256 },
    }, { onStepStart, onStepToken, onStepComplete, onDone });

    expect(result.steps).toBe(4);
    expect(result.text).toContain('Parallel delegation plan');
    expect(result.text).toContain('Subagent assignments');
    expect(onStepComplete).toHaveBeenCalledWith('coordinator', expect.stringContaining('Audit TODO coverage in src'));
    expect(onStepStart).toHaveBeenCalledTimes(4);
    expect(onStepToken).toHaveBeenCalled();
    expect(onStepComplete).toHaveBeenCalledTimes(4);
    expect(onDone).toHaveBeenCalledWith(result.text);
    expect(runAgentLoop).toHaveBeenCalledTimes(2);
    expect(vi.mocked(runAgentLoop).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ completionChecker: expect.any(Object), maxIterations: 5 }),
    );
  });

  it('passes the coordinator-selected problem into each remote worker task', async () => {
    const seenUserTasks: string[] = [];
    const model = {
      doStream: vi.fn(async ({ prompt }) => {
        const system = prompt[0]?.content as string;
        const userTask = prompt[1]?.content?.[0]?.text as string;
        seenUserTasks.push(userTask);

        const response = system.includes('delegation-worker:coordinator')
          ? 'Repair the broken staged delegation flow in agent-browser.'
          : '- ok';

        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({ type: 'text-start', id: 'text-0' });
              controller.enqueue({ type: 'text-delta', id: 'text-0', delta: response });
              controller.enqueue({ type: 'text-end', id: 'text-0' });
              controller.enqueue({
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: {
                  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
                  outputTokens: { total: 0, text: 0, reasoning: 0 },
                },
              });
              controller.close();
            },
          }),
        };
      }),
    };

    await runParallelDelegationWorkflow({
      model: model as never,
      prompt: 'figure out a multi-step problem to solve that can be parallelized; parallelize it and delegate the work to subagents.',
      workspaceName: 'Research',
      capabilities: { provider: 'copilot', contextWindow: 2048, maxOutputTokens: 256 },
    });

    expect(seenUserTasks).toHaveLength(2);
    expect(seenUserTasks[0]).toContain('Coordinator brief: choose one concrete multi-step problem');
    expect(seenUserTasks[1]).toContain('Chosen delegation problem: Repair the broken staged delegation flow in agent-browser.');
    expect(runAgentLoop).toHaveBeenCalledTimes(2);
  });

  it('uses one compact local delegation pass and routes distinct streamed sections to each subagent', async () => {
    const streamedChunks = [
      '<think>hidden planning</think>===PRO',
      'BLEM===\nAudit lib coverage health.\n===BREAK',
      'DOWN===\n- Run coverage for independent libraries.\n- Collect per-metric coverage outputs.\n===ASSIGNMENT===\n',
      '- Agent A: cover inbrowser-use and hand off results.\n- Agent B: cover webmcp and hand off results.\n===VALIDATION===\n',
      '- Confirm all libraries are included.\n- Flag any metric below 100%.',
    ];

    const doStream = vi.fn(async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'text-start', id: 'text-0' });
          for (const delta of streamedChunks) {
            controller.enqueue({ type: 'text-delta', id: 'text-0', delta });
          }
          controller.enqueue({ type: 'text-end', id: 'text-0' });
          controller.enqueue({
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: {
              inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
              outputTokens: { total: 0, text: 0, reasoning: 0 },
            },
          });
          controller.close();
        },
      }),
    }));

    const model = { provider: 'local', doStream };
    const onStepToken = vi.fn();
    const onStepComplete = vi.fn();

    const result = await runParallelDelegationWorkflow({
      model: model as never,
      prompt: 'figure out a multi-step problem to solve that can be parallelized; parallelize it and delegate the work to subagents.',
      workspaceName: 'Research',
      capabilities: { provider: 'local', contextWindow: 2048, maxOutputTokens: 256 },
    }, { onStepToken, onStepComplete });

    expect(doStream).toHaveBeenCalledTimes(1);
    expect(doStream.mock.calls[0]?.[0]).toMatchObject({
      maxOutputTokens: 96,
      temperature: 0.1,
    });
    expect(result.text).toContain('Parallel delegation plan');
    expect(result.text).not.toContain('<think>');
    expect(onStepToken).not.toHaveBeenCalledWith('coordinator', 'hidden planning');
    expect(onStepComplete).toHaveBeenCalledWith('coordinator', 'Audit lib coverage health.');
    expect(onStepComplete).toHaveBeenCalledWith('breakdown-agent', expect.stringContaining('Run coverage for independent libraries.'));
    expect(onStepComplete).toHaveBeenCalledWith('assignment-agent', expect.stringContaining('Agent A: cover inbrowser-use and hand off results.'));
    expect(onStepComplete).toHaveBeenCalledWith('validation-agent', expect.stringContaining('Confirm all libraries are included.'));

    const tokenBodies = onStepToken.mock.calls.map(([stepId, delta]) => `${stepId}:${String(delta)}`);
    expect(tokenBodies.some((entry) => entry.includes('breakdown-agent:- Run coverage for independent libraries.'))).toBe(true);
    expect(tokenBodies.some((entry) => entry.includes('assignment-agent:- Agent A: cover inbrowser-use and hand off results.'))).toBe(true);
    expect(tokenBodies.some((entry) => entry.includes('validation-agent:- Confirm all libraries are included.'))).toBe(true);
    expect(tokenBodies.some((entry) => entry.includes('breakdown-agent:- Agent A: cover inbrowser-use'))).toBe(false);
    expect(tokenBodies.some((entry) => entry.includes('assignment-agent:- Confirm all libraries are included.'))).toBe(false);
    expect(runAgentLoop).toHaveBeenCalledTimes(1);
  });
});
