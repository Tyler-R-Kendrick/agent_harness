import { describe, expect, it, vi } from 'vitest';
import type { ToolSet } from 'ai';
import { PayloadType } from 'logact';
import { runLogActActorWorkflow, type LogActActorExecuteContext } from './logactActorWorkflow';
import type { ToolDescriptor } from '../tools';
import type { ToolPlan } from '../tool-agents/tool-agent';

const descriptor: ToolDescriptor = {
  id: 'read_session_file',
  label: 'Read session file',
  description: 'Read a file from the active session filesystem.',
  group: 'built-in',
  groupLabel: 'Built-In',
};

const plan: ToolPlan = {
  version: 1,
  goal: 'Inspect AGENTS.md',
  selectedToolIds: ['read_session_file'],
  createdToolFiles: [],
  steps: [],
  actorToolAssignments: {
    'student-driver': [],
    'voter:teacher': [],
    'adversary-driver': [],
    'judge-decider': [],
    executor: ['read_session_file'],
  },
};

describe('runLogActActorWorkflow', () => {
  it('writes dynamic LogAct actors to the AgentBus before executor action', async () => {
    const onBusEntry = vi.fn();
    const onVoterStep = vi.fn();
    const execute = vi.fn(async (_context: LogActActorExecuteContext) => ({ text: 'executor result', steps: 1 }));

    const result = await runLogActActorWorkflow({
      messages: [{ role: 'user', content: 'Inspect AGENTS.md' }],
      instructions: 'Use tools carefully.',
      workspaceName: 'Research',
      plan,
      selectedDescriptors: [descriptor],
      selectedTools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      execute,
    }, { onBusEntry, onVoterStep });

    expect(result).toEqual({ text: 'executor result', steps: 1 });
    expect(execute).toHaveBeenCalledTimes(1);
    const firstExecuteContext = execute.mock.calls[0]?.[0];
    expect(firstExecuteContext).toBeDefined();
    expect(firstExecuteContext?.toolPolicy.allowedToolIds).toEqual(['read_session_file']);

    const actors = onBusEntry.mock.calls.map(([entry]) => entry.actorId ?? entry.actor);
    expect(actors).toEqual(expect.arrayContaining([
      'tools-selected',
      'tool-agent',
      'student-driver',
      'voter:teacher',
      'adversary-driver',
      'judge-decider',
      'judge-approved',
      'executor',
      'execute-plan',
      'execution-complete',
      'workflow-complete',
    ]));
    expect(actors).not.toEqual(expect.arrayContaining(['logact', 'teacher-voter', 'executor-agent']));
    expect(actors.indexOf('judge-decider')).toBeLessThan(actors.indexOf('adversary-driver'));
    expect(onBusEntry.mock.calls.map(([entry]) => entry.payloadType)).toEqual(expect.arrayContaining([
      PayloadType.Intent,
      PayloadType.Vote,
      PayloadType.Policy,
      PayloadType.Commit,
      PayloadType.Result,
      PayloadType.Completion,
    ]));
    expect(onVoterStep.mock.calls.map(([step]) => step.voterId)).toContain('voter:teacher');
    const entries = onBusEntry.mock.calls.map(([entry]) => entry);
    const toolAgentPolicy = entries.find((entry) => (
      entry.actorId === 'tool-agent'
      && entry.actorRole === 'driver'
      && entry.payloadType === PayloadType.Policy
      && entry.detail.includes('read_session_file')
    ));
    const teacherVote = entries.find((entry) => entry.actorId === 'voter:teacher');
    const judgeEntry = entries.find((entry) => entry.actorId === 'judge-decider');
    const resultEntry = entries.find((entry) => entry.payloadType === PayloadType.Result);
    expect(toolAgentPolicy?.branchId).toBe('agent:tool-agent');
    expect(toolAgentPolicy?.parentActorId).toBe('logact');
    expect(teacherVote?.branchId).toBe('agent:judge-decider');
    expect(judgeEntry?.branchId).toBe('agent:judge-decider');
    expect(resultEntry?.branchId).toBe('agent:executor');
  });

  it('uses named operation nodes for LogAct branch mergebacks instead of raw logact rows', async () => {
    const onBusEntry = vi.fn();
    const execute = vi.fn(async () => ({ text: 'executor result', steps: 1 }));

    await runLogActActorWorkflow({
      messages: [{ role: 'user', content: 'Inspect AGENTS.md' }],
      instructions: 'Use tools carefully.',
      workspaceName: 'Research',
      plan,
      selectedDescriptors: [descriptor],
      selectedTools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      execute,
      negativeRubricTechniques: ['negative-rubric-technique: keyword-stuffing without task grounding'],
    }, { onBusEntry });

    const entries = onBusEntry.mock.calls.map(([entry]) => entry);
    expect(entries.map((entry) => entry.actorId ?? entry.actor)).not.toContain('logact');

    const toolsSelected = entries.find((entry) => entry.actorId === 'tools-selected');
    const judgeApproved = entries.find((entry) => entry.actorId === 'judge-approved');
    const executionComplete = entries.find((entry) => entry.actorId === 'execution-complete');
    const workflowComplete = entries.find((entry) => entry.actorId === 'workflow-complete');

    expect(toolsSelected).toMatchObject({
      payloadType: PayloadType.Completion,
      parentActorId: 'tool-agent',
      branchId: 'agent:logact',
    });
    expect(judgeApproved).toMatchObject({
      payloadType: PayloadType.Completion,
      parentActorId: 'judge-decider',
      branchId: 'agent:logact',
    });
    expect(executionComplete).toMatchObject({
      payloadType: PayloadType.Completion,
      parentActorId: 'executor',
      branchId: 'agent:logact',
    });
    expect(workflowComplete).toMatchObject({
      payloadType: PayloadType.Completion,
      parentActorId: 'execution-complete',
      branchId: 'main',
    });
  });

  it('runs student self-reflection and teacher/student revision loops before judge scoring', async () => {
    const onBusEntry = vi.fn();
    const onVoterStep = vi.fn();
    const onAgentHandoff = vi.fn();
    const execute = vi.fn(async () => ({ text: 'executor result', steps: 1 }));

    await runLogActActorWorkflow({
      messages: [{ role: 'user', content: 'Inspect AGENTS.md' }],
      instructions: 'Use tools carefully.',
      workspaceName: 'Research',
      plan,
      selectedDescriptors: [descriptor],
      selectedTools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      execute,
      negativeRubricTechniques: ['negative-rubric-technique: keyword-stuffing without task grounding'],
    }, { onBusEntry, onVoterStep, onAgentHandoff });

    const entries = onBusEntry.mock.calls.map(([entry]) => entry);
    const studentReflectionEntries = entries.filter((entry) => (
      entry.actorId === 'student-driver'
      && entry.payloadType === PayloadType.InfOut
      && /self-reflection round/i.test(entry.detail)
    ));
    const teacherVotes = entries.filter((entry) => entry.actorId === 'voter:teacher');
    const teacherAdviceIndex = entries.findIndex((entry) => (
      entry.actorId === 'voter:teacher'
      && entry.payloadType === PayloadType.Vote
      && entry.detail.includes('Teacher advice round')
    ));
    const studentRevisionIndex = entries.findIndex((entry) => (
      entry.actorId === 'student-driver'
      && entry.payloadType === PayloadType.Intent
      && entry.detail.includes('Teacher/student revision')
    ));
    const teacherApprovalIndex = entries.findIndex((entry) => (
      entry.actorId === 'voter:teacher'
      && entry.payloadType === PayloadType.Vote
      && entry.detail.includes('Teacher approved')
    ));
    const firstJudgeIndex = entries.findIndex((entry) => entry.actorId === 'judge-decider');

    expect(onAgentHandoff.mock.calls.map(([from, to]) => `${from}->${to}`)).toEqual(expect.arrayContaining([
      'logact->tool-agent',
      'logact->student-driver',
      'student-driver->voter:teacher',
      'voter:teacher->student-driver',
    ]));
    expect(studentReflectionEntries).toHaveLength(2);
    expect(studentReflectionEntries[0].detail).toContain('predict the teacher response');
    expect(teacherVotes.map((entry) => entry.detail)).toEqual(expect.arrayContaining([
      expect.stringContaining('Teacher advice round'),
      expect.stringContaining('Teacher approved'),
    ]));
    expect(onVoterStep.mock.calls.map(([step]) => step.voterId)).toEqual(['voter:teacher', 'voter:teacher']);
    expect(teacherAdviceIndex).toBeGreaterThan(studentReflectionEntries.at(-1)!.position);
    expect(studentRevisionIndex).toBeGreaterThan(teacherAdviceIndex);
    expect(teacherApprovalIndex).toBeGreaterThan(studentRevisionIndex);
    expect(firstJudgeIndex).toBeGreaterThan(teacherApprovalIndex);
  });

  it('hardens the judge rubric and reruns when the adversary wins the first score', async () => {
    const onBusEntry = vi.fn();
    const execute = vi.fn(async () => ({ text: 'executor result', steps: 1 }));

    await runLogActActorWorkflow({
      messages: [{ role: 'user', content: 'Inspect AGENTS.md' }],
      instructions: 'Use tools carefully.',
      workspaceName: 'Research',
      plan,
      selectedDescriptors: [descriptor],
      selectedTools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      execute,
      negativeRubricTechniques: [],
    }, { onBusEntry });

    const entries = onBusEntry.mock.calls.map(([entry]) => entry);
    const policyEntries = entries.filter((entry) => entry.payloadType === PayloadType.Policy);
    expect(policyEntries.some((entry) => /negative-rubric-technique/.test(entry.detail))).toBe(true);
    expect(policyEntries.some((entry) => /judge-rerun/.test(entry.detail))).toBe(true);

    const studentInputs = entries.filter((entry) => (
      entry.actorId === 'student-driver' && entry.payloadType === PayloadType.InfIn
    ));
    const adversaryInputs = entries.filter((entry) => (
      entry.actorId === 'adversary-driver' && entry.payloadType === PayloadType.InfIn
    ));
    expect(studentInputs.map((entry) => entry.passIndex)).toEqual([1, 2]);
    expect(adversaryInputs.map((entry) => entry.passIndex)).toEqual([1, 2]);
    expect(studentInputs[1].detail).toContain('Previous AgentBus context');
    expect(adversaryInputs[1].detail).toContain('Previous AgentBus context');

    const rerunIndex = entries.findIndex((entry) => /judge-rerun/.test(entry.detail));
    const secondStudentIndex = entries.findIndex((entry) => (
      entry.actorId === 'student-driver' && entry.payloadType === PayloadType.InfIn && entry.passIndex === 2
    ));
    const commitIndex = entries.findIndex((entry) => entry.payloadType === PayloadType.Commit);
    const resultIndex = entries.findIndex((entry) => entry.payloadType === PayloadType.Result);
    expect(rerunIndex).toBeGreaterThan(-1);
    expect(secondStudentIndex).toBeGreaterThan(rerunIndex);
    expect(commitIndex).toBeGreaterThan(secondStudentIndex);
    expect(resultIndex).toBeGreaterThan(commitIndex);

    const commits = entries.filter((entry) => entry.payloadType === PayloadType.Commit);
    expect(commits).toHaveLength(1);
    expect(commits[0].actorId).toBe('judge-decider');
    expect(commits[0].passIndex).toBe(2);
    expect(entries.some((entry) => entry.actorId === 'execute-plan' && entry.payloadType === PayloadType.Intent)).toBe(true);
    expect(entries.find((entry) => entry.payloadType === PayloadType.Result)?.actorId).toBe('executor');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('aborts without executor action when the adversary wins every allowed pass', async () => {
    const onBusEntry = vi.fn();
    const execute = vi.fn(async () => ({ text: 'executor result', steps: 1 }));

    const result = await runLogActActorWorkflow({
      messages: [{ role: 'user', content: 'Inspect AGENTS.md' }],
      instructions: 'Use tools carefully.',
      workspaceName: 'Research',
      plan,
      selectedDescriptors: [descriptor],
      selectedTools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      execute,
      negativeRubricTechniques: [],
      maxPasses: 1,
    }, { onBusEntry });

    const entries = onBusEntry.mock.calls.map(([entry]) => entry);
    expect(result.text).toMatch(/aborted/i);
    expect(execute).not.toHaveBeenCalled();
    expect(entries.some((entry) => entry.payloadType === PayloadType.Abort)).toBe(true);
    expect(entries.some((entry) => entry.payloadType === PayloadType.Commit)).toBe(false);
  });

  it('logs executor failure and reruns LogAct with the failed attempt in AgentBus context', async () => {
    const onBusEntry = vi.fn();
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new Error('tool result did not satisfy the committed plan'))
      .mockResolvedValueOnce({ text: 'recovered executor result', steps: 1 });

    const result = await runLogActActorWorkflow({
      messages: [{ role: 'user', content: 'Inspect AGENTS.md' }],
      instructions: 'Use tools carefully.',
      workspaceName: 'Research',
      plan,
      selectedDescriptors: [descriptor],
      selectedTools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      execute,
    }, { onBusEntry });

    const entries = onBusEntry.mock.calls.map(([entry]) => entry);
    const failedResult = entries.find((entry) => (
      entry.actorId === 'executor'
      && entry.payloadType === PayloadType.Result
      && entry.detail.includes('tool result did not satisfy the committed plan')
    ));
    expect(result).toEqual({ text: 'recovered executor result', steps: 1 });
    expect(execute).toHaveBeenCalledTimes(2);
    expect(failedResult).toBeDefined();
    expect(failedResult?.branchId).toBe('agent:executor');
    expect(entries.some((entry) => (
      entry.actorId === 'execution-failed'
      && entry.payloadType === PayloadType.Completion
      && entry.detail.includes('Executor failed')
    ))).toBe(true);
    expect(entries.some((entry) => (
      entry.actorId === 'execution-recovery'
      && entry.payloadType === PayloadType.Policy
      && entry.detail.includes('execution-recovery')
    ))).toBe(true);

    const secondExecutionContext = execute.mock.calls[1]?.[0] as LogActActorExecuteContext | undefined;
    expect(secondExecutionContext?.busEntries.some((entry) => (
      entry.actorId === 'executor'
      && entry.detail.includes('tool result did not satisfy the committed plan')
    ))).toBe(true);
    const recoveryStudentInputIndex = entries.findIndex((entry) => (
      entry.actorId === 'student-driver'
      && entry.payloadType === PayloadType.InfIn
      && entry.detail.includes('Executor failed')
    ));
    const failedResultIndex = entries.indexOf(failedResult!);
    expect(recoveryStudentInputIndex).toBeGreaterThan(failedResultIndex);
  });

  it('logs user elicitation as a paused completion without rerunning LogAct as a failure', async () => {
    const onBusEntry = vi.fn();
    const execute = vi.fn(async () => ({
      text: 'What city or neighborhood should I use to list restaurants near you?',
      steps: 3,
      blocked: true,
      needsUserInput: true,
      elicitation: {
        status: 'needs_user_input',
        requestId: 'elicitation-1',
      },
    }));

    const result = await runLogActActorWorkflow({
      messages: [{ role: 'user', content: 'list restaurants near me' }],
      instructions: 'Use tools carefully.',
      workspaceName: 'Research',
      plan,
      selectedDescriptors: [descriptor],
      selectedTools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      execute,
      negativeRubricTechniques: ['negative-rubric-technique: keyword-stuffing without task grounding'],
    }, { onBusEntry });

    const entries = onBusEntry.mock.calls.map(([entry]) => entry);
    expect(result).toMatchObject({
      blocked: true,
      needsUserInput: true,
      text: 'What city or neighborhood should I use to list restaurants near you?',
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(entries.find((entry) => entry.payloadType === PayloadType.Result)).toMatchObject({
      actorId: 'executor',
      branchId: 'agent:executor',
    });
    expect(entries.some((entry) => (
      entry.actorId === 'execution-paused'
      && entry.payloadType === PayloadType.Completion
      && entry.detail.includes('needs_user_input')
    ))).toBe(true);
    expect(entries.some((entry) => entry.actorId === 'execution-recovery')).toBe(false);
    expect(entries.some((entry) => entry.payloadType === PayloadType.Abort)).toBe(false);
    expect(entries.some((entry) => entry.actorId === 'workflow-complete')).toBe(false);
  });

  it('aborts after bounded executor failures instead of retrying tools forever', async () => {
    const onBusEntry = vi.fn();
    const execute = vi.fn(async () => {
      throw new Error('execution unavailable');
    });

    const result = await runLogActActorWorkflow({
      messages: [{ role: 'user', content: 'Inspect AGENTS.md' }],
      instructions: 'Use tools carefully.',
      workspaceName: 'Research',
      plan,
      selectedDescriptors: [descriptor],
      selectedTools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      execute,
      negativeRubricTechniques: ['negative-rubric-technique: keyword-stuffing without task grounding'],
      maxExecutionAttempts: 2,
    } as Parameters<typeof runLogActActorWorkflow>[0] & { maxExecutionAttempts: number }, { onBusEntry });

    const entries = onBusEntry.mock.calls.map(([entry]) => entry);
    expect(result.text).toMatch(/aborted after 2 executor attempts/i);
    expect(result).toMatchObject({ failed: true, error: 'execution unavailable' });
    expect(execute).toHaveBeenCalledTimes(2);
    expect(entries.filter((entry) => (
      entry.actorId === 'executor'
      && entry.payloadType === PayloadType.Result
      && entry.detail.includes('execution unavailable')
    ))).toHaveLength(2);
    expect(entries.some((entry) => entry.payloadType === PayloadType.Abort)).toBe(true);
    expect(entries.filter((entry) => entry.actorId === 'workflow-aborted' && entry.branchId === 'main')).toHaveLength(1);
  });
});
