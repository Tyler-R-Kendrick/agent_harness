import React from 'react';
import { createRoot } from 'react-dom/client';
import { ProcessDrilldown, ProcessPanel } from '../features/process';
import type { BusEntryStep, ChatMessage, ReasoningStep, VoterStep } from '../types';
import type { ProcessEntry, ProcessEntryKind } from '../services/processLog';
import '../index.css';
import '../App.css';

// ─── Mock data ────────────────────────────────────────────────────────────

const T0 = 1_700_000_000_000;

const reasoningSteps: ReasoningStep[] = [
  {
    id: 'coordinator',
    kind: 'thinking',
    title: 'Coordinator brief',
    body: 'Framing the delegated problem and selecting subagents.',
    transcript:
      'I need to break this down into independent subtasks so several agents can work in parallel. The coordinator picks the breakdown, assignment, and review subagents.',
    startedAt: T0,
    endedAt: T0 + 4_000,
    timeoutMs: 240_000,
    status: 'done',
  },
  {
    id: 'breakdown',
    kind: 'thinking',
    title: 'Breakdown subagent',
    body: 'Splitting the work into orthogonal slices.',
    transcript:
      'Slice 1: data plumbing. Slice 2: UI surfaces. Slice 3: validation harness. Each slice is independent enough to delegate.',
    startedAt: T0 + 4_500,
    endedAt: T0 + 9_000,
    timeoutMs: 240_000,
    status: 'done',
    parentStepId: 'coordinator',
    lane: 'parallel',
  },
  {
    id: 'assignment',
    kind: 'thinking',
    title: 'Assignment subagent',
    body: 'Assigning owners to each slice.',
    transcript:
      'Owner A handles plumbing, Owner B handles UI, Owner C handles validation. All three start in parallel.',
    startedAt: T0 + 4_500,
    endedAt: T0 + 9_200,
    timeoutMs: 210_000,
    status: 'done',
    parentStepId: 'coordinator',
    lane: 'parallel',
  },
  {
    id: 'validation',
    kind: 'thinking',
    title: 'Validation subagent',
    body: 'Defining checks and risks before execution.',
    transcript:
      'Confirm each slice has an owner, check the slices do not overlap, and verify the handoff criteria stay explicit.',
    startedAt: T0 + 4_500,
    endedAt: T0 + 9_300,
    timeoutMs: 210_000,
    status: 'done',
    parentStepId: 'coordinator',
    lane: 'parallel',
  },
  {
    id: 'reviewers',
    kind: 'thinking',
    title: 'Reviewer votes',
    body: 'Teacher voter evaluated the student delegation plan.',
    transcript:
      'Teacher voter evaluated the delegation plan.\n- teacher-voter: Approved — Teacher approved the student candidate after checking decomposition, ownership, and validation.\n- judge-decider: Committed the student design after adversary probing.',
    startedAt: T0 + 9_500,
    endedAt: T0 + 11_500,
    status: 'done',
    parentStepId: 'coordinator',
  },
  {
    id: 'agent-bus-log',
    kind: 'thinking',
    title: 'AgentBus log',
    body: '10 AgentBus entries recorded during this run.',
    transcript:
      '10 AgentBus entries recorded during this run.\n1. Mail · user — Plan a parallel delegation for analysing the dataset.\n2. InfIn · 2 message(s) — student-driver drafts the candidate.\n3. InfOut — student-driver self-checks the delegation design.\n4. Intent · delegation-abc — student candidate\n5. Vote · teacher-voter ✓ — Teacher approved the student candidate.\n6. Policy · delegation-judge-rubric — judge rubric active\n7. InfIn · 2 message(s) — adversary-driver probes the rubric.\n8. Intent · delegation-abc:adversary — adversary rubric exploit attempt\n9. Commit · delegation-abc — judge committed the student design\n10. Result · delegation-abc — executor-agent produced output',
    startedAt: T0 + 11_600,
    endedAt: T0 + 12_400,
    status: 'done',
    parentStepId: 'coordinator',
  },
];

const voterSteps: VoterStep[] = [
  {
    id: 'voter-teacher',
    kind: 'agent',
    title: 'teacher-voter',
    voterId: 'teacher-voter',
    body: 'Approved',
    approve: true,
    thought: 'Teacher approved the student candidate after checking decomposition, ownership, and validation.',
    startedAt: T0 + 9_500,
    endedAt: T0 + 11_000,
    status: 'done',
  },
];

const busEntries: BusEntryStep[] = [
  {
    id: 'bus-0',
    position: 0,
    realtimeTs: T0 + 100,
    payloadType: 'Mail',
    summary: 'Mail · user',
    detail: 'Plan a parallel delegation for analysing the dataset.',
    actor: 'user',
    actorId: 'user',
    actorRole: 'user',
    branchId: 'main',
  },
  {
    id: 'bus-1',
    position: 1,
    realtimeTs: T0 + 4_600,
    payloadType: 'InfIn',
    summary: 'InfIn · 2 message(s)',
    detail: 'system: Student driver: draft and self-check a parallel delegation design.\n\nuser: Plan a parallel delegation for analysing the dataset.',
    actorId: 'student-driver',
    actorRole: 'driver',
    parentActorId: 'logact',
    branchId: 'agent:student-driver',
    agentLabel: 'Student Driver',
  },
  {
    id: 'bus-2',
    position: 2,
    realtimeTs: T0 + 8_900,
    payloadType: 'InfOut',
    summary: 'InfOut',
    detail: 'Student delegation candidate\n\nProblem: Identify a pattern in the dataset.\n\nBreakdown:\n- Track 1\n- Track 2\n\nAssignments:\n- Role: Analyst | Owns: Track 1 | Handoff: Reporter\n- Role: Reporter | Owns: Track 2 | Handoff: final report',
    actorId: 'student-driver',
    actorRole: 'driver',
    parentActorId: 'logact',
    branchId: 'agent:student-driver',
    agentLabel: 'Student Driver',
  },
  {
    id: 'bus-3',
    position: 3,
    realtimeTs: T0 + 9_400,
    payloadType: 'Intent',
    summary: 'Intent · delegation-abc',
    detail: 'student delegation candidate',
    actorId: 'student-driver',
    actorRole: 'driver',
    parentActorId: 'logact',
    branchId: 'agent:student-driver',
    agentLabel: 'Student Driver',
  },
  {
    id: 'bus-4',
    position: 4,
    realtimeTs: T0 + 10_900,
    payloadType: 'Vote',
    summary: 'Vote · teacher-voter ✓',
    detail: 'Teacher approved the student candidate after checking decomposition, ownership, and validation.',
    actor: 'teacher-voter',
    actorId: 'teacher-voter',
    actorRole: 'voter',
    parentActorId: 'student-driver',
    branchId: 'agent:teacher-voter',
    agentLabel: 'Teacher Voter',
  },
  {
    id: 'bus-5',
    position: 5,
    realtimeTs: T0 + 11_000,
    payloadType: 'Policy',
    summary: 'Policy · delegation-judge-rubric',
    detail: '{"criteria":["breakdown contains at least two distinct parallel tracks","assignment maps every emitted track to an explicit role and handoff","validation contains checks or risks distinct from the work breakdown"]}',
    actorId: 'judge-decider',
    actorRole: 'decider',
    parentActorId: 'logact',
    branchId: 'agent:judge-decider',
    agentLabel: 'Judge Decider',
  },
  {
    id: 'bus-6',
    position: 6,
    realtimeTs: T0 + 11_100,
    payloadType: 'InfIn',
    summary: 'InfIn · 2 message(s)',
    detail: 'system: Adversary driver: try to subvert the judge rubric.\n\nuser: Game the rubric by over-weighting role labels.',
    actorId: 'adversary-driver',
    actorRole: 'driver',
    parentActorId: 'judge-decider',
    branchId: 'agent:adversary-driver',
    agentLabel: 'Adversary Driver',
  },
  {
    id: 'bus-7',
    position: 7,
    realtimeTs: T0 + 11_200,
    payloadType: 'Intent',
    summary: 'Intent · delegation-abc:adversary',
    detail: 'Adversary attempt: game the rubric by over-weighting role labels.',
    actorId: 'adversary-driver',
    actorRole: 'driver',
    parentActorId: 'judge-decider',
    branchId: 'agent:adversary-driver',
    agentLabel: 'Adversary Driver',
  },
  {
    id: 'bus-8',
    position: 8,
    realtimeTs: T0 + 11_500,
    payloadType: 'Commit',
    summary: 'Commit · delegation-abc',
    detail: 'intent committed',
    actorId: 'judge-decider',
    actorRole: 'decider',
    parentActorId: 'logact',
    branchId: 'agent:judge-decider',
    agentLabel: 'Judge Decider',
  },
  {
    id: 'bus-9',
    position: 9,
    realtimeTs: T0 + 12_000,
    payloadType: 'Result',
    summary: 'Result · delegation-abc',
    detail: 'Executor produced the final delegated report.',
    actorId: 'executor-agent',
    actorRole: 'executor',
    parentActorId: 'judge-decider',
    branchId: 'agent:executor-agent',
    agentLabel: 'Executor Agent',
  },
];

const BUS_KIND_MAP: Record<string, ProcessEntryKind> = {
  Mail: 'mail',
  InfIn: 'inf-in',
  InfOut: 'inf-out',
  Intent: 'intent',
  Vote: 'vote',
  Commit: 'commit',
  Abort: 'abort',
  Result: 'result',
  Completion: 'completion',
  Policy: 'policy',
};

const processEntries: ProcessEntry[] = [
  {
    id: 'stage:coordinator',
    position: 0,
    ts: reasoningSteps[0].startedAt,
    endedAt: reasoningSteps[0].endedAt,
    kind: 'stage-start',
    actor: 'coordinator',
    summary: reasoningSteps[0].title,
    transcript: reasoningSteps[0].transcript,
    branchId: 'coordinator',
    status: 'done',
  },
  {
    id: 'stage:breakdown',
    position: 1,
    ts: reasoningSteps[1].startedAt,
    endedAt: reasoningSteps[1].endedAt,
    kind: 'subagent',
    actor: 'breakdown-agent',
    summary: reasoningSteps[1].title,
    transcript: reasoningSteps[1].transcript,
    parentId: 'stage:coordinator',
    branchId: 'breakdown-agent',
    status: 'done',
  },
  {
    id: 'stage:assignment',
    position: 2,
    ts: reasoningSteps[2].startedAt,
    endedAt: reasoningSteps[2].endedAt,
    kind: 'subagent',
    actor: 'assignment-agent',
    summary: reasoningSteps[2].title,
    transcript: reasoningSteps[2].transcript,
    parentId: 'stage:coordinator',
    branchId: 'assignment-agent',
    status: 'done',
  },
  {
    id: 'stage:validation',
    position: 3,
    ts: reasoningSteps[3].startedAt,
    endedAt: reasoningSteps[3].endedAt,
    kind: 'subagent',
    actor: 'validation-agent',
    summary: reasoningSteps[3].title,
    transcript: reasoningSteps[3].transcript,
    parentId: 'stage:coordinator',
    branchId: 'validation-agent',
    status: 'done',
  },
  {
    id: 'stage:reviewers',
    position: 4,
    ts: reasoningSteps[4].startedAt,
    endedAt: reasoningSteps[4].endedAt,
    kind: 'reasoning',
    actor: 'voter-ensemble',
    summary: reasoningSteps[4].title,
    transcript: reasoningSteps[4].transcript,
    parentId: 'stage:coordinator',
    branchId: 'voters',
    status: 'done',
  },
  ...voterSteps.map((step, index) => ({
    id: `vote:${step.id}`,
    position: 5 + index,
    ts: step.startedAt,
    endedAt: step.endedAt,
    kind: 'vote' as const,
    actor: step.voterId,
    actorId: step.voterId,
    actorRole: 'voter',
    parentActorId: 'student-driver',
    agentId: step.voterId,
    agentLabel: 'Teacher Voter',
    summary: step.approve ? `${step.voterId} ✓` : `${step.voterId} ✗`,
    transcript: step.thought ?? step.body,
    payload: step,
    branchId: 'agent:teacher-voter',
    status: 'done' as const,
  })),
  {
    id: 'stage:agent-bus',
    position: 6,
    ts: reasoningSteps[5].startedAt,
    endedAt: reasoningSteps[5].endedAt,
    kind: 'reasoning',
    actor: 'agent-bus',
    summary: reasoningSteps[5].title,
    transcript: reasoningSteps[5].transcript,
    parentId: 'stage:coordinator',
    branchId: 'bus',
    status: 'done',
  },
  ...busEntries.map((entry, index) => ({
    id: entry.id,
    position: 7 + index,
    ts: entry.realtimeTs,
    endedAt: entry.realtimeTs,
    kind: BUS_KIND_MAP[entry.payloadType] ?? 'reasoning',
    actor: entry.actorId ?? entry.actor ?? 'bus',
    ...(entry.actorId !== undefined ? { actorId: entry.actorId } : {}),
    ...(entry.actorRole !== undefined ? { actorRole: entry.actorRole } : {}),
    ...(entry.parentActorId !== undefined ? { parentActorId: entry.parentActorId } : {}),
    ...(entry.actorId !== undefined ? { agentId: entry.actorId } : {}),
    ...(entry.agentLabel !== undefined ? { agentLabel: entry.agentLabel } : {}),
    summary: entry.summary,
    transcript: entry.detail,
    payload: entry,
    branchId: entry.branchId ?? 'bus',
    status: 'done' as const,
  })),
];

const baseMessage: ChatMessage = {
  id: 'fixture-message',
  role: 'assistant',
  content: 'Workflow visualization fixture.',
  processEntries,
  reasoningSteps,
  reasoningStartedAt: T0,
  thinkingDuration: 12,
  isThinking: false,
  voterSteps,
  isVoting: false,
  busEntries,
};

// ─── Fixture switchboard ──────────────────────────────────────────────────

type FixtureName = 'workflow-graph' | 'workflow-drilldown' | 'process-vote-detail' | 'process-bus-detail';

function readFixtureName(): FixtureName {
  const params = new URLSearchParams(window.location.search);
  const requested = (params.get('fixture') ?? 'workflow-graph') as FixtureName;
  return requested;
}

function Fixture() {
  const name = readFixtureName();
  const breakdownEntry = processEntries.find((entry) => entry.id === 'stage:breakdown');
  const voteEntry = processEntries.find((entry) => entry.id === 'vote:voter-teacher');
  const busEntry = processEntries.find((entry) => entry.id === 'bus-1');

  if (!breakdownEntry || !voteEntry || !busEntry) {
    throw new Error('Missing process fixture entries');
  }

  if (name === 'workflow-graph') {
    return (
      <div className="fixture-frame">
        <ProcessPanel message={baseMessage} onClose={() => undefined} />
      </div>
    );
  }

  if (name === 'workflow-drilldown') {
    return (
      <div className="fixture-frame">
        <ProcessPanel message={baseMessage} onClose={() => undefined} />
        <ProcessDrilldown entry={breakdownEntry} onBack={() => undefined} />
      </div>
    );
  }

  if (name === 'process-vote-detail') {
    return (
      <div className="fixture-frame">
        <ProcessPanel message={baseMessage} onClose={() => undefined} />
        <ProcessDrilldown entry={voteEntry} onBack={() => undefined} />
      </div>
    );
  }

  return (
    <div className="fixture-frame">
      <ProcessPanel message={baseMessage} onClose={() => undefined} />
      <ProcessDrilldown entry={busEntry} onBack={() => undefined} />
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <Fixture />
    </React.StrictMode>,
  );
}
