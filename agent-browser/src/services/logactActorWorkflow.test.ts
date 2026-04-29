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

async function appendAcceptedTheaterCandidate(context: LogActActorExecuteContext): Promise<void> {
  await context.bus.append({
    type: PayloadType.Result,
    intentId: 'validated-candidates-test-accepted',
    output: JSON.stringify({
      type: 'validated-search-candidates',
      candidates: [{
        name: 'AMC Randhurst 12',
        validationStatus: 'accepted',
        subjectMatch: true,
        locationEvidence: ['Randhurst Village in Mount Prospect near Arlington Heights, IL'],
        entityLink: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12',
        sourceEvidence: ['movie theater listing at Randhurst Village near Arlington Heights, IL'],
      }, {
        name: 'CMX Arlington Heights',
        validationStatus: 'accepted',
        subjectMatch: true,
        locationEvidence: ['53 S Evergreen Ave in Arlington Heights, IL'],
        entityLink: 'https://www.cmxcinemas.com/location/cmx-arlington-heights',
        sourceEvidence: ['movie theater listing in Arlington Heights, IL'],
      }],
      rejected: [],
    }),
    meta: {
      actorId: 'search-analyzer',
      actorRole: 'executor',
      parentActorId: 'execute-plan',
      branchId: 'agent:executor',
    },
  });
}
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
      parentActorId: 'response-ready',
      branchId: 'main',
    });
  });

  it('writes validation criteria and recursive validation requirements before voters and deciders act', async () => {
    const onBusEntry = vi.fn();
    const execute = vi.fn(async () => ({
      text: '1. [AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12) - Why: Source-backed theater listing near Arlington Heights, IL.',
      steps: 1,
    }));

    await runLogActActorWorkflow({
      messages: [{ role: 'user', content: "what're the best movie theaters near me?" }],
      instructions: 'Use tools carefully.',
      workspaceName: 'Research',
      plan,
      selectedDescriptors: [descriptor],
      selectedTools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      execute,
      negativeRubricTechniques: ['negative-rubric-technique: keyword-stuffing without task grounding'],
      verificationCriteria: [
        'Answer must contain actual named entities.',
        'Links must resolve to entity-specific pages.',
        'Nearby requests require geographic evidence.',
      ],
    } as Parameters<typeof runLogActActorWorkflow>[0] & { verificationCriteria: string[] }, { onBusEntry });

    const entries = onBusEntry.mock.calls.map(([entry]) => entry);
    const validationContractIndex = entries.findIndex((entry) => (
      entry.actorId === 'validation-agent'
      && entry.payloadType === PayloadType.Policy
      && entry.detail.includes('recursive-tool-call-validation')
      && entry.detail.includes('post-processing-output-validation')
      && entry.detail.includes('Answer must contain actual named entities.')
    ));
    const firstVoterIndex = entries.findIndex((entry) => entry.actorRole === 'voter' || entry.actorId === 'voter:teacher');
    const firstDeciderIndex = entries.findIndex((entry) => entry.actorRole === 'decider' || entry.actorId === 'judge-decider');

    expect(validationContractIndex).toBeGreaterThan(-1);
    expect(validationContractIndex).toBeLessThan(firstVoterIndex);
    expect(validationContractIndex).toBeLessThan(firstDeciderIndex);
  });

  it('post-processes executor output through AgentBus before returning the final answer', async () => {
    const onBusEntry = vi.fn();
    const execute = vi.fn(async (context: LogActActorExecuteContext) => {
      await appendAcceptedTheaterCandidate(context);
      return {
        text: [
          'AgentBus Result Write-back',
          '',
          'Here are movie theaters near Arlington Heights, IL:',
          '',
          '1. [AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12) - Why: Official source with showtimes.',
        ].join('\n'),
        steps: 1,
      };
    });

    const result = await runLogActActorWorkflow({
      messages: [{ role: 'user', content: "what're the best movie theaters near me?" }],
      instructions: 'Use tools carefully.',
      workspaceName: 'Research',
      plan,
      selectedDescriptors: [descriptor],
      selectedTools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      execute,
      negativeRubricTechniques: ['negative-rubric-technique: keyword-stuffing without task grounding'],
    }, { onBusEntry });

    const entries = onBusEntry.mock.calls.map(([entry]) => entry);
    const actors = entries.map((entry) => entry.actorId ?? entry.actor);
    const postProcessorReflections = entries.filter((entry) => (
      entry.actorId === 'post-processor'
      && entry.payloadType === PayloadType.InfOut
      && /self-reflection round/i.test(entry.detail)
    ));
    const postProcessorResult = entries.find((entry) => (
      entry.actorId === 'post-processor'
      && entry.payloadType === PayloadType.Result
    ));
    const postProcessorValidations = entries.filter((entry) => (
      entry.actorId === 'validation-agent'
      && entry.payloadType === PayloadType.Result
      && /validate-post-processor/.test(entry.summary)
    ));
    const responseReady = entries.find((entry) => entry.actorId === 'response-ready');
    const workflowComplete = entries.find((entry) => entry.actorId === 'workflow-complete');

    expect(result.text).toContain('[AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12)');
    expect(result.text).not.toContain('AgentBus Result Write-back');
    expect(actors).toEqual(expect.arrayContaining(['execution-complete', 'post-processor', 'verification-agent', 'response-ready', 'workflow-complete']));
    expect(postProcessorReflections).toHaveLength(3);
    expect(postProcessorValidations).toHaveLength(postProcessorReflections.length + 1);
    expect(postProcessorValidations.map((entry) => entry.detail)).toEqual(expect.arrayContaining([
      expect.stringContaining('post-processor self-reflection round 1'),
      expect.stringContaining('post-processor self-reflection round 2'),
      expect.stringContaining('post-processor self-reflection round 3'),
      expect.stringContaining('post-processor final output'),
    ]));
    expect(postProcessorResult?.detail).toContain('AMC Randhurst 12');
    expect(postProcessorResult?.detail).not.toContain('AgentBus Result Write-back');
    expect(responseReady).toMatchObject({
      payloadType: PayloadType.Completion,
      parentActorId: 'verification-agent',
      branchId: 'agent:logact',
    });
    expect(workflowComplete).toMatchObject({
      payloadType: PayloadType.Completion,
      parentActorId: 'response-ready',
      branchId: 'main',
    });
    expect(actors.indexOf('execution-complete')).toBeLessThan(actors.indexOf('post-processor'));
    expect(actors.indexOf('post-processor')).toBeLessThan(actors.indexOf('verification-agent'));
    expect(actors.indexOf('verification-agent')).toBeLessThan(actors.indexOf('response-ready'));
    expect(actors.indexOf('response-ready')).toBeLessThan(actors.indexOf('workflow-complete'));
  });

  it('rejects invalid post-processed entity labels with a verification-agent and reruns before response-ready', async () => {
    const onBusEntry = vi.fn();
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        text: [
          'Here are movie theaters near Arlington Heights, IL:',
          '',
          '1. [Movies](https://www.fandango.com/movies) - Why: Found on a showtimes source source page for Arlington Heights, IL.',
          "2. ['Supergirl' Trailer](https://www.fandango.com/movie-news/supergirl-trailer) - Why: Found on a showtimes source source page for Arlington Heights, IL.",
          '3. [Skip to Main Content](https://www.fandango.com/arlington-heights_il_movietimes#main) - Why: Found on a showtimes source source page for Arlington Heights, IL.',
        ].join('\n'),
        steps: 3,
      })
      .mockImplementationOnce(async (context: LogActActorExecuteContext) => {
        await appendAcceptedTheaterCandidate(context);
        return {
          text: [
            'Here are movie theaters near Arlington Heights, IL:',
            '',
            '1. [AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12) - Why: Source-backed theater listing near Arlington Heights, IL.',
          ].join('\n'),
          steps: 3,
        };
      });

    const result = await runLogActActorWorkflow({
      messages: [{ role: 'user', content: "what're the best movie theaters near me?" }],
      instructions: 'Use tools carefully.',
      workspaceName: 'Research',
      plan,
      selectedDescriptors: [descriptor],
      selectedTools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      execute,
      negativeRubricTechniques: ['negative-rubric-technique: keyword-stuffing without task grounding'],
      maxExecutionAttempts: 2,
      verificationCriteria: [
        'Answer must contain actual named entities.',
        'Links must resolve to entity-specific pages.',
        'Entities must match the requested subject.',
        'Nearby requests require geographic evidence.',
        'Generic page/navigation labels are forbidden.',
      ],
    } as Parameters<typeof runLogActActorWorkflow>[0] & { verificationCriteria: string[]; maxExecutionAttempts: number }, { onBusEntry });

    const entries = onBusEntry.mock.calls.map(([entry]) => entry);
    const actors = entries.map((entry) => entry.actorId ?? entry.actor);
    const verificationResults = entries.filter((entry) => (
      entry.actorId === 'verification-agent'
      && entry.payloadType === PayloadType.Result
    ));
    const firstResponseReadyIndex = actors.indexOf('response-ready');
    const firstFailedVerificationIndex = entries.findIndex((entry) => (
      entry.actorId === 'verification-agent'
      && entry.payloadType === PayloadType.Result
      && /Movies|Supergirl|Skip to Main Content/.test(entry.detail)
    ));

    expect(result.text).toContain('[AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12)');
    expect(result.text).not.toMatch(/^\s*\d+\.\s+\[(?:Movies|'Supergirl' Trailer|Skip to Main Content)\]/m);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(actors).toEqual(expect.arrayContaining(['post-processor', 'verification-agent', 'response-ready', 'workflow-complete']));
    expect(verificationResults).toHaveLength(2);
    expect(verificationResults[0].detail).toMatch(/passed":false|passed: false/i);
    expect(verificationResults[1].detail).toMatch(/passed":true|passed: true/i);
    expect(firstFailedVerificationIndex).toBeGreaterThan(-1);
    expect(firstResponseReadyIndex).toBeGreaterThan(firstFailedVerificationIndex);
    expect(entries.some((entry) => (
      entry.actorId === 'verification-recovery'
      && entry.payloadType === PayloadType.Policy
      && entry.detail.includes('Verification failed')
    ))).toBe(true);
  });

  it('aborts after bounded verifier failures without publishing a bad answer', async () => {
    const onBusEntry = vi.fn();
    const execute = vi.fn(async () => ({
      text: [
        'Here are movie theaters near Arlington Heights, IL:',
        '',
        '1. [Movies](https://www.fandango.com/movies) - Why: Found on a showtimes source page.',
      ].join('\n'),
      steps: 1,
    }));

    const result = await runLogActActorWorkflow({
      messages: [{ role: 'user', content: "what're the best movie theaters near me?" }],
      instructions: 'Use tools carefully.',
      workspaceName: 'Research',
      plan,
      selectedDescriptors: [descriptor],
      selectedTools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      execute,
      negativeRubricTechniques: ['negative-rubric-technique: keyword-stuffing without task grounding'],
      maxExecutionAttempts: 2,
      verificationCriteria: ['Answer must contain actual named entities.', 'Generic page/navigation labels are forbidden.'],
    } as Parameters<typeof runLogActActorWorkflow>[0] & { verificationCriteria: string[]; maxExecutionAttempts: number }, { onBusEntry });

    const entries = onBusEntry.mock.calls.map(([entry]) => entry);

    expect(result).toMatchObject({ failed: true });
    expect(result.text).toMatch(/verification failed after 2 attempts|could not verify/i);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(entries.filter((entry) => entry.actorId === 'verification-agent' && entry.payloadType === PayloadType.Result)).toHaveLength(2);
    expect(entries.some((entry) => entry.actorId === 'response-ready')).toBe(false);
    expect(entries.some((entry) => entry.payloadType === PayloadType.Abort)).toBe(true);
  });

  it('rejects source-page chrome labels that are not actual requested nearby entities', async () => {
    const onBusEntry = vi.fn();
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        text: [
          'Here are movie theaters near Arlington Heights, IL:',
          '',
          '1. [Theaters](https://www.fandango.com/theaters) - Why: Found on a showtimes source source page for Arlington Heights, IL.',
          '2. [TV Shows](https://www.fandango.com/tv) - Why: Found on a showtimes source source page for Arlington Heights, IL.',
          '3. [FanStore](https://www.fandango.com/fanstore) - Why: Found on a showtimes source source page for Arlington Heights, IL.',
        ].join('\n'),
        steps: 4,
      })
      .mockImplementationOnce(async (context: LogActActorExecuteContext) => {
        await appendAcceptedTheaterCandidate(context);
        return {
          text: [
            'Here are movie theaters near Arlington Heights, IL:',
            '',
            '1. [AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12) - Why: Theater listing at Randhurst Village in Mount Prospect, near Arlington Heights, IL.',
            '2. [CMX Arlington Heights](https://www.cmxcinemas.com/location/cmx-arlington-heights) - Why: Theater listing in Arlington Heights, IL.',
          ].join('\n'),
          steps: 4,
        };
      });

    const result = await runLogActActorWorkflow({
      messages: [{ role: 'user', content: "what're the best movie theaters near me?" }],
      instructions: 'Use tools carefully.',
      workspaceName: 'Research',
      plan,
      selectedDescriptors: [descriptor],
      selectedTools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      execute,
      maxExecutionAttempts: 2,
      verificationCriteria: [
        'Answer must contain actual named entities.',
        'Each listed item must be a specific instance of the requested subject.',
        'Links must resolve to entity-specific pages.',
        'Nearby requests require per-entity geographic or proximity evidence.',
        'Generic page/navigation labels are forbidden.',
      ],
    } as Parameters<typeof runLogActActorWorkflow>[0] & { verificationCriteria: string[]; maxExecutionAttempts: number }, { onBusEntry });

    const entries = onBusEntry.mock.calls.map(([entry]) => entry);
    const verificationResults = entries.filter((entry) => (
      entry.actorId === 'verification-agent'
      && entry.payloadType === PayloadType.Result
    ));

    expect(execute).toHaveBeenCalledTimes(2);
    expect(result.text).toContain('[AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12)');
    expect(result.text).toContain('Mount Prospect');
    expect(result.text).toContain('[CMX Arlington Heights](https://www.cmxcinemas.com/location/cmx-arlington-heights)');
    expect(result.text).not.toMatch(/^\s*\d+\.\s+\[(?:Theaters|TV Shows|FanStore)\]/m);
    expect(verificationResults).toHaveLength(2);
    expect(verificationResults[0].detail).toContain('Theaters');
    expect(verificationResults[0].detail).toContain('TV Shows');
    expect(verificationResults[0].detail).toContain('FanStore');
    expect(verificationResults[0].detail).toMatch(/specific instance|non-entity|generic/i);
    expect(verificationResults[1].detail).toMatch(/passed":true|passed: true/i);
  });

  it('requires structured accepted candidates before response-ready for entity-seeking answers', async () => {
    const onBusEntry = vi.fn();
    const execute = vi
      .fn()
      .mockImplementationOnce(async (context: LogActActorExecuteContext) => {
        await context.bus.append({
          type: PayloadType.Result,
          intentId: 'validated-candidates-attempt-1',
          output: JSON.stringify({
            type: 'validated-search-candidates',
            candidates: [],
            rejected: [
              { name: 'At Home', validationStatus: 'rejected', validationFailures: ['not a source-backed requested-subject entity'] },
              { name: 'Streaming', validationStatus: 'rejected', validationFailures: ['not a source-backed requested-subject entity'] },
              { name: 'Coming Soon', validationStatus: 'rejected', validationFailures: ['not a source-backed requested-subject entity'] },
            ],
          }),
          meta: {
            actorId: 'search-analyzer',
            actorRole: 'executor',
            parentActorId: 'execute-plan',
            branchId: 'agent:executor',
          },
        });
        return {
          text: [
            'Here are movie theaters near Arlington Heights, IL:',
            '',
            '1. [At Home](https://www.fandango.com/watch-at-home) - Why: Movie theater option near Arlington Heights, IL from source page.',
            '2. [Streaming](https://www.fandango.com/streaming) - Why: Movie theater option near Arlington Heights, IL from source page.',
            '3. [Coming Soon](https://www.fandango.com/coming-soon) - Why: Movie theater option near Arlington Heights, IL from source page.',
          ].join('\n'),
          steps: 4,
        };
      })
      .mockImplementationOnce(async (context: LogActActorExecuteContext) => {
        await context.bus.append({
          type: PayloadType.Result,
          intentId: 'validated-candidates-attempt-2',
          output: JSON.stringify({
            type: 'validated-search-candidates',
            candidates: [{
              name: 'AMC Randhurst 12',
              validationStatus: 'accepted',
              subjectMatch: true,
              locationEvidence: ['Randhurst Village in Mount Prospect near Arlington Heights, IL'],
              entityLink: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12',
              sourceEvidence: ['movie theater listing at Randhurst Village'],
            }],
            rejected: [],
          }),
          meta: {
            actorId: 'search-analyzer',
            actorRole: 'executor',
            parentActorId: 'execute-plan',
            branchId: 'agent:executor',
          },
        });
        return {
          text: [
            'Here are movie theaters near Arlington Heights, IL:',
            '',
            '1. [AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12) - Why: Movie theater listing at Randhurst Village in Mount Prospect near Arlington Heights, IL.',
          ].join('\n'),
          steps: 4,
        };
      });

    const result = await runLogActActorWorkflow({
      messages: [{ role: 'user', content: "what're the best movie theaters near me?" }],
      instructions: 'Use tools carefully.',
      workspaceName: 'Research',
      plan,
      selectedDescriptors: [descriptor],
      selectedTools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      execute,
      maxExecutionAttempts: 2,
      verificationCriteria: [
        'Answer must contain actual named entities.',
        'Each listed item must be a specific instance of the requested subject.',
        'Nearby requests require per-entity geographic or proximity evidence.',
        'Verification must require at least one accepted structured candidate for entity-seeking tasks.',
      ],
    } as Parameters<typeof runLogActActorWorkflow>[0] & { verificationCriteria: string[]; maxExecutionAttempts: number }, { onBusEntry });

    const entries = onBusEntry.mock.calls.map(([entry]) => entry);
    const verificationResults = entries.filter((entry) => (
      entry.actorId === 'verification-agent'
      && entry.payloadType === PayloadType.Result
    ));

    expect(execute).toHaveBeenCalledTimes(2);
    expect(result.text).toContain('[AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12)');
    expect(result.text).not.toMatch(/^\s*\d+\.\s+\[(?:At Home|Streaming|Coming Soon)\]/m);
    expect(verificationResults).toHaveLength(2);
    expect(verificationResults[0].detail).toMatch(/accepted structured candidate|At Home|Streaming|Coming Soon/i);
    expect(verificationResults[1].detail).toMatch(/passed":true|passed: true/i);
    expect(entries.findIndex((entry) => entry.actorId === 'response-ready')).toBeGreaterThan(
      entries.findIndex((entry) => entry.detail.includes('validated-candidates-attempt-2')),
    );
  });

  it('rejects the reported runtime page-chrome answer even when orchestrator criteria are missing', async () => {
    const onBusEntry = vi.fn();
    const execute = vi.fn(async () => ({
      text: [
        'Here are movie theaters near Arlington Heights, IL:',
        '',
        '1. [At Home](https://www.fandango.com/watch-at-home) - Why: Found on a showtimes source source page for Arlington Heights, IL. page link',
        '2. [Movie Charts](https://www.fandango.com/movie-charts) - Why: Found on a showtimes source source page for Arlington Heights, IL. page link',
        '3. [Movie News](https://www.fandango.com/movie-news) - Why: Found on a showtimes source source page for Arlington Heights, IL. page link',
      ].join('\n'),
      steps: 4,
    }));

    const result = await runLogActActorWorkflow({
      messages: [{ role: 'user', content: "what're the best movie theaters near me?" }],
      instructions: 'Use tools carefully.',
      workspaceName: 'Research',
      plan,
      selectedDescriptors: [descriptor],
      selectedTools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      execute,
      maxExecutionAttempts: 1,
    }, { onBusEntry });

    const entries = onBusEntry.mock.calls.map(([entry]) => entry);
    const verificationResult = entries.find((entry) => (
      entry.actorId === 'verification-agent'
      && entry.payloadType === PayloadType.Result
    ));

    expect(result).toMatchObject({ failed: true });
    expect(result.text).toMatch(/verification failed|could not verify/i);
    expect(verificationResult?.detail).toMatch(/At Home|Movie Charts|Movie News/i);
    expect(verificationResult?.detail).toMatch(/accepted structured candidate|specific instance|non-entity|generic/i);
    expect(entries.some((entry) => entry.actorId === 'response-ready')).toBe(false);
  });

  it('uses AgentBus memory evidence to apply citation-oriented response preferences in post-processing', async () => {
    const onBusEntry = vi.fn();
    const execute = vi.fn(async (context: LogActActorExecuteContext) => {
      await appendAcceptedTheaterCandidate(context);
      await context.bus.append({
        type: PayloadType.Result,
        intentId: 'executor-tool-memory',
        output: JSON.stringify({
          status: 'found',
          memories: [{
            id: 'preference.response.citations',
            label: 'Response preference',
            value: 'Prefers citations',
            source: 'workspace-memory',
          }],
        }),
        meta: {
          actorId: 'webmcp:recall_user_context',
          actorRole: 'tool',
          parentActorId: 'execute-plan',
          branchId: 'agent:executor',
        },
      });
      return {
        text: [
          'Here are movie theaters near Arlington Heights, IL:',
          '',
          '1. [AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12) - Why: Official source with showtimes.',
        ].join('\n'),
        steps: 1,
      };
    });

    const result = await runLogActActorWorkflow({
      messages: [{ role: 'user', content: "what're the best movie theaters near me?" }],
      instructions: 'Use tools carefully.',
      workspaceName: 'Research',
      plan,
      selectedDescriptors: [descriptor],
      selectedTools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      execute,
    }, { onBusEntry });

    const postProcessorResult = onBusEntry.mock.calls
      .map(([entry]) => entry)
      .find((entry) => entry.actorId === 'post-processor' && entry.payloadType === PayloadType.Result);
    expect(result.text).toContain('Sources:');
    expect(result.text).toContain('[AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12)');
    expect(postProcessorResult?.detail).toContain('Sources:');
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
