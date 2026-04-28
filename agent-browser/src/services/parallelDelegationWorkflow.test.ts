import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../chat-agents/agent-loop', async () => {
  const actual = await vi.importActual<typeof import('../chat-agents/agent-loop')>('../chat-agents/agent-loop');
  return {
    ...actual,
    runAgentLoop: vi.fn(actual.runAgentLoop),
  };
});
const runStagedToolPipelineMock = vi.fn();
vi.mock('./stagedToolPipeline', () => ({
  runStagedToolPipeline: (options: unknown, callbacks: unknown) => runStagedToolPipelineMock(options, callbacks),
}));

import { runAgentLoop } from '../chat-agents/agent-loop';
import { PLAN_FILE_PATH } from './planFile';
import {
  parseDelegationAssignmentContracts,
  buildDelegationProblemBrief,
  buildSectionedDelegationPrompt,
  createDelegationSectionRouter,
  DELEGATION_SECTION_MARKERS,
  isParallelDelegationPrompt,
  shouldRunParallelDelegation,
  runParallelDelegationWorkflow,
} from './parallelDelegationWorkflow';
import type { BusEntryStep } from '../types';

function makeStreamingModel(responses: Record<string, string>) {
  return {
    doStream: vi.fn(async ({ prompt }) => {
      const system = prompt[0]?.content as string;
      const response = Object.entries(responses)
        .sort(([left], [right]) => right.length - left.length)
        .find(([marker]) => system.includes(marker))?.[1] ?? 'fallback';

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
    runStagedToolPipelineMock.mockReset();
  });

  it('detects delegation prompts via keyword combinations', () => {
    expect(isParallelDelegationPrompt('parallelize this and delegate it to subagents')).toBe(true);
    expect(isParallelDelegationPrompt('Identify a multi-step problem suitable for parallelization, break it into independent tasks, and delegate each to subagents for concurrent execution.')).toBe(true);
    expect(isParallelDelegationPrompt('delegate this')).toBe(false);
  });

  it('shouldRunParallelDelegation skips delegation for local models that are too small for the staged pipeline', () => {
    const text = 'parallelize this and delegate it to subagents';
    expect(shouldRunParallelDelegation(text, { provider: 'local', contextWindow: 2048, maxOutputTokens: 256 })).toBe(false);
    expect(shouldRunParallelDelegation(text, { provider: 'copilot', contextWindow: 8192, maxOutputTokens: 1024 })).toBe(true);
    expect(shouldRunParallelDelegation('hello there', { provider: 'copilot', contextWindow: 8192, maxOutputTokens: 1024 })).toBe(false);
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
    expect(prompt).toContain('Role: <specialist role> | Owns: <track and scope> | Handoff: <next role or deliverable>');
    expect(prompt).toContain('Each Owns field must begin with the exact breakdown track text it covers.');
  });

  it('parses strict assignment contracts and rejects loose agent labels', () => {
    expect(parseDelegationAssignmentContracts([
      '- Role: Planner specialist | Owns: map the seams and required runtime inputs | Handoff: Executor specialist',
      '- Role: Executor specialist | Owns: wire execution and focused verification | Handoff: final report',
    ].join('\n'))).toEqual([
      {
        role: 'Planner specialist',
        owns: 'map the seams and required runtime inputs',
        handoff: 'Executor specialist',
      },
      {
        role: 'Executor specialist',
        owns: 'wire execution and focused verification',
        handoff: 'final report',
      },
    ]);

    expect(parseDelegationAssignmentContracts('- Agent 1: inspect the seams\n- Agent 2: wire the executor')).toEqual([]);
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
      'delegation-worker:sectioned-plan': '===PROBLEM===\nAudit TODO coverage in src without broad scans.\n===BREAKDOWN===\n- Task A\n- Task B\n===ASSIGNMENT===\n- Role: Reader specialist | Owns: Task A with source inspection only | Handoff: Reporter specialist\n- Role: Reporter specialist | Owns: Task B with summary synthesis only | Handoff: final report\n===VALIDATION===\n- Risk: drift\n- Check: compare outputs',
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
    expect(result.text).toContain('teacher-voter');
    expect(result.text).toContain('Teacher approved the student candidate');
    expect(result.text).not.toContain('assignment-has-roles');
    expect(onStepComplete).toHaveBeenCalledWith('coordinator', expect.stringContaining('Audit TODO coverage in src'));
    expect(onStepStart.mock.calls.map(([stepId]) => stepId)).toEqual([
      'chat-agent',
      'planner',
      'coordinator',
      'breakdown-agent',
      'assignment-agent',
      'validation-agent',
      'router-agent',
      'orchestrator',
      'tool-agent',
    ]);
    expect(onStepToken).toHaveBeenCalled();
    expect(onStepComplete.mock.calls.map(([stepId]) => stepId)).toEqual([
      'chat-agent',
      'coordinator',
      'breakdown-agent',
      'assignment-agent',
      'validation-agent',
      'planner',
      'router-agent',
      'orchestrator',
      'tool-agent',
    ]);
    expect(onDone).toHaveBeenCalledWith(result.text);
    expect(runAgentLoop).toHaveBeenCalledTimes(2);
    expect(vi.mocked(runAgentLoop).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ completionChecker: expect.any(Object), maxIterations: 5 }),
    );
  });

  it('starts at chat-agent, emits handoffs, and includes the executor result in the AgentBus report', async () => {
    const model = makeStreamingModel({
      'delegation-worker:coordinator': 'Repair the process flow so execution produces outputs.',
      'delegation-worker:sectioned-plan': [
        '===PROBLEM===',
        'Repair the process flow so execution produces outputs.',
        '===BREAKDOWN===',
        '- Inspect workflow start point.',
        '- Wire execution output capture.',
        '===ASSIGNMENT===',
        '- Role: Planner specialist | Owns: Inspect workflow start point and classify the prompt | Handoff: Orchestrator specialist',
        '- Role: Executor specialist | Owns: Wire execution output capture and report results | Handoff: final report',
        '===VALIDATION===',
        '- Check: AgentBus includes a Result entry.',
        '- Confirm: handoffs are explicit.',
      ].join('\n'),
    });
    const onStepStart = vi.fn();
    const onAgentHandoff = vi.fn();
    const busEntries: Array<{ payloadType: string; summary: string; actorId?: string }> = [];

    const result = await runParallelDelegationWorkflow({
      model: model as never,
      prompt: 'fix the process flow and delegate the work to subagents',
      workspaceName: 'Research',
      capabilities: { provider: 'copilot', contextWindow: 2048, maxOutputTokens: 256 },
    }, {
      onStepStart,
      onAgentHandoff,
      onBusEntry: (entry: BusEntryStep) => busEntries.push({
        payloadType: entry.payloadType,
        summary: entry.summary,
        ...(entry.actorId !== undefined ? { actorId: entry.actorId } : {}),
      }),
    } as never);

    const startedStages = onStepStart.mock.calls.map(([stepId]) => stepId);
    expect(startedStages[0]).toBe('chat-agent');
    expect(startedStages).toContain('planner');
    expect(startedStages).toContain('router-agent');
    expect(startedStages).toContain('orchestrator');
    expect(startedStages).toContain('tool-agent');
    expect(onAgentHandoff).toHaveBeenCalledWith('chat-agent', 'planner', expect.stringContaining('classify'));
    expect(onAgentHandoff).toHaveBeenCalledWith('planner', 'router-agent', expect.stringContaining('classify succinct tasks'));
    expect(onAgentHandoff).toHaveBeenCalledWith('router-agent', 'orchestrator', expect.stringContaining('routed tasks'));
    expect(onAgentHandoff).toHaveBeenCalledWith('orchestrator', 'tool-agent', expect.stringContaining('active workspace tools'));

    const payloadTypes = busEntries.map((entry) => entry.payloadType);
    expect(payloadTypes).toContain('Commit');
    expect(payloadTypes.at(-1)).toBe('Result');
    expect(new Set(busEntries.map((entry) => entry.actorId).filter(Boolean))).toEqual(new Set([
      'student-driver',
      'teacher-voter',
      'judge-decider',
      'adversary-driver',
      'executor-agent',
    ]));
    expect(result.text).toContain('Result · delegation');
    expect(result.text).toContain('Repair the process flow so execution produces outputs.');
  });

  it('rejects assignment bullets that do not cover the exact emitted breakdown tracks', async () => {
    const model = makeStreamingModel({
      'delegation-worker:coordinator': 'Audit TODO coverage in src without broad scans.',
      'delegation-worker:sectioned-plan': '===PROBLEM===\nAudit TODO coverage in src without broad scans.\n===BREAKDOWN===\n- Inspect src TODO coverage\n- Inspect test TODO coverage\n===ASSIGNMENT===\n- Role: Reader specialist | Owns: source inspection only | Handoff: Reporter specialist\n- Role: Reporter specialist | Owns: summary synthesis only | Handoff: final report\n===VALIDATION===\n- Risk: drift\n- Check: compare outputs',
    });

    const result = await runParallelDelegationWorkflow({
      model: model as never,
      prompt: 'figure out a multi-step problem to solve that can be parallelized; parallelize it and delegate the work to subagents.',
      workspaceName: 'Research',
      capabilities: { provider: 'copilot', contextWindow: 2048, maxOutputTokens: 256 },
    });

    expect(result.text).toContain('teacher-voter');
    expect(result.text).toContain('Student did not map each emitted track to an explicit role or owner with a stated handoff');
    expect(result.text).not.toContain('assignment-has-roles');
  });

  it('aborts the LogAct plan pipeline when a voter rejects instead of committing it', async () => {
    const model = makeStreamingModel({
      'delegation-worker:coordinator': 'Audit TODO coverage in src without broad scans.',
      'delegation-worker:sectioned-plan': [
        '===PROBLEM===',
        'Audit TODO coverage in src without broad scans.',
        '===BREAKDOWN===',
        '- Inspect src TODO coverage.',
        '- Inspect test TODO coverage.',
        '===ASSIGNMENT===',
        '- Role: Reader specialist | Owns: source inspection only | Handoff: Reporter specialist',
        '- Role: Reporter specialist | Owns: summary synthesis only | Handoff: final report',
        '===VALIDATION===',
        '- Risk: drift',
        '- Check: compare outputs',
      ].join('\n'),
    });

    const result = await runParallelDelegationWorkflow({
      model: model as never,
      prompt: 'figure out a multi-step problem to solve that can be parallelized; parallelize it and delegate the work to subagents.',
      workspaceName: 'Research',
      capabilities: { provider: 'copilot', contextWindow: 2048, maxOutputTokens: 256 },
    });

    expect(result.text).toContain('Abort · delegation');
    expect(result.text).not.toContain('Commit · delegation');
    expect(result.text).toContain('Student did not map each emitted track to an explicit role or owner');
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
      '- Role: Coverage specialist A | Owns: Run coverage for independent libraries across inbrowser-use and summarize the metrics | Handoff: Coverage specialist B\n- Role: Coverage specialist B | Owns: Collect per-metric coverage outputs for webmcp and combine the summaries | Handoff: final report\n===VALIDATION===\n',
      '- Confirm all libraries are included.\n- Flag any metric below 100%.',
    ];

    const doStream = vi.fn(async (_options: unknown) => ({
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
    expect(onStepComplete).toHaveBeenCalledWith('assignment-agent', expect.stringContaining('Role: Coverage specialist A | Owns: Run coverage for independent libraries across inbrowser-use and summarize the metrics | Handoff: Coverage specialist B'));
    expect(onStepComplete).toHaveBeenCalledWith('validation-agent', expect.stringContaining('Confirm all libraries are included.'));

    const tokenBodies = onStepToken.mock.calls.map(([stepId, delta]) => `${stepId}:${String(delta)}`);
    expect(tokenBodies.some((entry) => entry.includes('breakdown-agent:- Run coverage for independent libraries.'))).toBe(true);
    expect(tokenBodies.some((entry) => entry.includes('assignment-agent:- Role: Coverage specialist A | Owns: Run coverage for independent libraries across inbrowser-use and summarize the metrics | Handoff: Coverage specialist B'))).toBe(true);
    expect(tokenBodies.some((entry) => entry.includes('validation-agent:- Confirm all libraries are included.'))).toBe(true);
    expect(tokenBodies.some((entry) => entry.includes('breakdown-agent:- Role: Coverage specialist A | Owns: cover inbrowser-use'))).toBe(false);
    expect(tokenBodies.some((entry) => entry.includes('assignment-agent:- Confirm all libraries are included.'))).toBe(false);
    expect(runAgentLoop).toHaveBeenCalledTimes(1);
  });

  it('starts local delegation subagent stages only when their section begins streaming', async () => {
    const streamedChunks = [
      '===PROBLEM===\nInvestigate coverage drift.\n===BREAKDOWN===\n',
      '- Audit libraries\n- Compare reports\n===ASSIGNMENT===\n',
      '- Role: Audit specialist | Owns: audit libraries only | Handoff: final report\n===VALIDATION===\n',
      '- Verify thresholds hold',
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

    const onStepStart = vi.fn();

    await runParallelDelegationWorkflow({
      model: { provider: 'local', doStream } as never,
      prompt: 'figure out a multi-step problem to solve that can be parallelized; parallelize it and delegate the work to subagents.',
      workspaceName: 'Research',
      capabilities: { provider: 'local', contextWindow: 2048, maxOutputTokens: 256 },
    }, { onStepStart });

    expect(onStepStart.mock.calls.map(([stepId]) => stepId)).toEqual([
      'chat-agent',
      'planner',
      'coordinator',
      'breakdown-agent',
      'assignment-agent',
      'validation-agent',
      'router-agent',
      'orchestrator',
      'tool-agent',
    ]);
  });

  it('executes planned tasks, writes PLAN.md, and narrows tools per task', async () => {
    runStagedToolPipelineMock
      .mockResolvedValueOnce({ text: 'Inspected the workflow seams and identified the missing runtime inputs.', steps: 1 })
      .mockResolvedValueOnce({ text: 'Implemented the executor wiring and verified the focused tests pass.', steps: 1 });
    const model = makeStreamingModel({
      'delegation-worker:coordinator': 'Repair the workflow so delegated tasks execute instead of returning a plan only.',
      'delegation-worker:sectioned-plan': '===PROBLEM===\nRepair the workflow so delegated tasks execute instead of returning a plan only.\n===BREAKDOWN===\n- Identify the execution seams and required tools.\n- Wire execution and verification through the existing loop.\n===ASSIGNMENT===\n- Role: Planner specialist | Owns: Identify the execution seams and required tools while mapping the runtime requirements | Handoff: Executor specialist\n- Role: Executor specialist | Owns: Wire execution and verification through the existing loop and report the results | Handoff: final report\n===VALIDATION===\n- Confirm each task declares validations before execution.\n- Confirm PLAN.md reflects running and done states.',
      'delegation-worker:task-planner': JSON.stringify({
        goal: 'Execute delegated work through the existing loop and verify each task.',
        tasks: [
          {
            id: 'inspect-seams',
            title: 'Inspect execution seams',
            description: 'Inspect the workflow seam and capture the required runtime inputs.',
            toolIds: ['read_session_file'],
            toolRationale: 'Read-only inspection is enough for the seam audit.',
            dependsOn: [],
            validations: [
              { id: 'seam-output', kind: 'response-contains', substrings: ['runtime inputs'] },
            ],
          },
          {
            id: 'wire-executor',
            title: 'Wire executor loop',
            description: 'Wire the executor flow and verify the focused tests pass.',
            toolIds: ['cli'],
            toolRationale: 'CLI is needed to run the focused test command.',
            dependsOn: ['inspect-seams'],
            validations: [
              { id: 'tests-pass', kind: 'shell-command', command: 'npm test -- --runInBand', expectExitCode: 0, stdoutIncludes: ['PASS'] },
              { id: 'executor-output', kind: 'response-contains', substrings: ['focused tests pass'] },
            ],
          },
        ],
      }),
    });
    const writePlanFile = vi.fn(async () => undefined);
    const runShellCommand = vi.fn(async () => ({ exitCode: 0, stdout: 'PASS\n2 tests passed', stderr: '' }));

    const result = await runParallelDelegationWorkflow({
      model: model as never,
      prompt: 'figure out a multi-step problem to solve that can be parallelized; parallelize it and delegate the work to subagents.',
      workspaceName: 'Research',
      capabilities: { provider: 'copilot', contextWindow: 2048, maxOutputTokens: 256 },
      execution: {
        tools: {
          cli: { execute: vi.fn() },
          read_session_file: { execute: vi.fn() },
        } as never,
        toolDescriptors: [
          {
            id: 'cli',
            label: 'CLI',
            description: 'Run shell commands.',
            group: 'built-in',
            groupLabel: 'Built-In',
          },
          {
            id: 'read_session_file',
            label: 'Read session file',
            description: 'Read a file from the session filesystem.',
            group: 'built-in',
            groupLabel: 'Built-In',
          },
        ],
        instructions: 'Use the selected tools and verify the work before claiming completion.',
        messages: [{ role: 'user', content: 'Repair the workflow end-to-end.' }],
        writePlanFile,
        listWorkspacePaths: async () => [PLAN_FILE_PATH],
        runShellCommand,
      },
    });

    expect(runStagedToolPipelineMock).toHaveBeenCalledTimes(2);
    expect(runStagedToolPipelineMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        toolDescriptors: [expect.objectContaining({ id: 'read_session_file' })],
        tools: expect.objectContaining({ read_session_file: expect.any(Object) }),
        completionChecker: expect.any(Object),
      }),
    );
    expect(runStagedToolPipelineMock.mock.calls[0]?.[0].tools.cli).toBeUndefined();
    expect(runStagedToolPipelineMock.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        toolDescriptors: [expect.objectContaining({ id: 'cli' })],
        tools: expect.objectContaining({ cli: expect.any(Object) }),
        completionChecker: expect.any(Object),
      }),
    );
    expect(runStagedToolPipelineMock.mock.calls[1]?.[0].tools.read_session_file).toBeUndefined();
    expect(runShellCommand).toHaveBeenCalledWith('npm test -- --runInBand');
    expect(writePlanFile).toHaveBeenCalledWith(PLAN_FILE_PATH, expect.stringContaining('Status: pending'));
    expect(writePlanFile).toHaveBeenLastCalledWith(
      PLAN_FILE_PATH,
      expect.stringContaining('Status: done'),
    );
    expect(result.steps).toBe(6);
    expect(result.text).toContain('Executable task plan');
    expect(result.text).toContain('Inspect execution seams');
    expect(result.text).toContain('Wire executor loop');
    expect(result.text).toContain('Implemented the executor wiring');
  });

  it('marks the task failed when validations still fail after execution', async () => {
    runStagedToolPipelineMock.mockResolvedValue({ text: 'Implemented the change but skipped verification.', steps: 1 });
    const model = makeStreamingModel({
      'delegation-worker:coordinator': 'Repair the workflow so delegated tasks execute instead of returning a plan only.',
      'delegation-worker:sectioned-plan': '===PROBLEM===\nRepair the workflow so delegated tasks execute instead of returning a plan only.\n===BREAKDOWN===\n- Execute the repair.\n- Verify the focused tests pass.\n===ASSIGNMENT===\n- Role: Executor specialist | Owns: Execute the repair and wire the workflow change | Handoff: Verification specialist\n- Role: Verification specialist | Owns: Verify the focused tests pass and report failures | Handoff: final report\n===VALIDATION===\n- Confirm tests pass before completion.',
      'delegation-worker:task-planner': JSON.stringify({
        goal: 'Execute the repair and verify it.',
        tasks: [
          {
            id: 'wire-executor',
            title: 'Wire executor loop',
            description: 'Wire the executor flow and verify the focused tests pass.',
            toolIds: ['cli'],
            dependsOn: [],
            validations: [
              { id: 'tests-pass', kind: 'shell-command', command: 'npm test -- --runInBand', expectExitCode: 0, stdoutIncludes: ['PASS'] },
            ],
          },
        ],
      }),
    });
    const writePlanFile = vi.fn(async () => undefined);

    await expect(runParallelDelegationWorkflow({
      model: model as never,
      prompt: 'figure out a multi-step problem to solve that can be parallelized; parallelize it and delegate the work to subagents.',
      workspaceName: 'Research',
      capabilities: { provider: 'copilot', contextWindow: 2048, maxOutputTokens: 256 },
      execution: {
        tools: { cli: { execute: vi.fn() } } as never,
        toolDescriptors: [{
          id: 'cli',
          label: 'CLI',
          description: 'Run shell commands.',
          group: 'built-in',
          groupLabel: 'Built-In',
        }],
        instructions: 'Use the selected tools and verify the work before claiming completion.',
        messages: [{ role: 'user', content: 'Repair the workflow end-to-end.' }],
        writePlanFile,
        listWorkspacePaths: async () => [PLAN_FILE_PATH],
        runShellCommand: async () => ({ exitCode: 1, stdout: 'FAIL', stderr: 'tests failed' }),
      },
    })).rejects.toThrow('tests-pass (shell-command) exit code 1 !== 0');

    expect(writePlanFile).toHaveBeenLastCalledWith(
      PLAN_FILE_PATH,
      expect.stringContaining('Status: failed'),
    );
  });
});
