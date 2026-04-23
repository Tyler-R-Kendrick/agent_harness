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
    body: '2 reviewers evaluated the delegation plan.',
    transcript:
      '2 reviewers evaluated the delegation plan.\n- breakdown-distinct-tracks: Approved — Confirmed the breakdown subagent emitted at least two distinct parallel tracks.\n- assignment-has-roles: Approved — Each track has an explicit role or owner with a stated handoff.',
    startedAt: T0 + 9_500,
    endedAt: T0 + 11_500,
    status: 'done',
    parentStepId: 'coordinator',
  },
  {
    id: 'agent-bus-log',
    kind: 'thinking',
    title: 'AgentBus log',
    body: '7 AgentBus entries recorded during this run.',
    transcript:
      '7 AgentBus entries recorded during this run.\n1. Mail · user — Plan a parallel delegation for analysing the dataset.\n2. InfIn · 2 message(s) — system: delegation-worker:sectioned-plan user: Plan a parallel delegation for analysing the dataset.\n3. InfOut — ===PROBLEM=== Identify a pattern in the dataset. ===BREAKDOWN=== - Track 1 - Track 2 ===ASSIGNMENT=== …\n4. Intent · delegation-abc — evaluate parallel-delegation plan\n5. Vote · breakdown-distinct-tracks ✓ — Confirmed the breakdown subagent emitted at least two distinct parallel tracks.\n6. Vote · assignment-has-roles ✓ — Each track has an explicit role or owner with a stated handoff.\n7. Commit · delegation-abc — intent committed',
    startedAt: T0 + 11_600,
    endedAt: T0 + 12_400,
    status: 'done',
    parentStepId: 'coordinator',
  },
];

const voterSteps: VoterStep[] = [
  {
    id: 'voter-correctness',
    kind: 'agent',
    title: 'breakdown-distinct-tracks',
    voterId: 'breakdown-distinct-tracks',
    body: 'Approved',
    approve: true,
    thought: 'Confirmed the breakdown subagent emitted at least two distinct parallel tracks.',
    startedAt: T0 + 9_500,
    endedAt: T0 + 11_000,
    status: 'done',
  },
  {
    id: 'voter-clarity',
    kind: 'agent',
    title: 'assignment-has-roles',
    voterId: 'assignment-has-roles',
    body: 'Approved',
    approve: true,
    thought: 'Each track has an explicit role or owner with a stated handoff.',
    startedAt: T0 + 9_500,
    endedAt: T0 + 11_500,
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
  },
  {
    id: 'bus-1',
    position: 1,
    realtimeTs: T0 + 4_600,
    payloadType: 'InfIn',
    summary: 'InfIn · 2 message(s)',
    detail: 'system: delegation-worker:sectioned-plan\n\nuser: Plan a parallel delegation for analysing the dataset.',
  },
  {
    id: 'bus-2',
    position: 2,
    realtimeTs: T0 + 8_900,
    payloadType: 'InfOut',
    summary: 'InfOut',
    detail: '===PROBLEM===\nIdentify a pattern in the dataset.\n===BREAKDOWN===\n- Track 1\n- Track 2\n===ASSIGNMENT===\n…',
  },
  {
    id: 'bus-3',
    position: 3,
    realtimeTs: T0 + 9_400,
    payloadType: 'Intent',
    summary: 'Intent · delegation-abc',
    detail: 'evaluate parallel-delegation plan',
  },
  {
    id: 'bus-4',
    position: 4,
    realtimeTs: T0 + 10_900,
    payloadType: 'Vote',
    summary: 'Vote · breakdown-distinct-tracks ✓',
    detail: 'Confirmed the breakdown subagent emitted at least two distinct parallel tracks.',
    actor: 'breakdown-distinct-tracks',
  },
  {
    id: 'bus-5',
    position: 5,
    realtimeTs: T0 + 11_400,
    payloadType: 'Vote',
    summary: 'Vote · assignment-has-roles ✓',
    detail: 'Each track has an explicit role or owner with a stated handoff.',
    actor: 'assignment-has-roles',
  },
  {
    id: 'bus-6',
    position: 6,
    realtimeTs: T0 + 11_500,
    payloadType: 'Commit',
    summary: 'Commit · delegation-abc',
    detail: 'intent committed',
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
    actor: `voter:${step.voterId}`,
    summary: step.approve ? `${step.voterId} ✓` : `${step.voterId} ✗`,
    transcript: step.thought ?? step.body,
    payload: step,
    branchId: 'voters',
    status: 'done' as const,
  })),
  {
    id: 'stage:agent-bus',
    position: 7,
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
    position: 8 + index,
    ts: entry.realtimeTs,
    endedAt: entry.realtimeTs,
    kind: BUS_KIND_MAP[entry.payloadType] ?? 'reasoning',
    actor: entry.actor ?? 'bus',
    summary: entry.summary,
    transcript: entry.detail,
    payload: entry,
    branchId: 'bus',
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
  const voteEntry = processEntries.find((entry) => entry.id === 'vote:voter-correctness');
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
