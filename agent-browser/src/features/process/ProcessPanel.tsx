import { ArrowLeft } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ChatMessage } from '../../types';
import { ProcessGraph } from './ProcessGraph';
import { ProcessDrilldown } from './ProcessDrilldown';
import { formatOperationDuration } from '../operation-pane';
import type { ProcessEntry, ProcessEntryKind } from '../../services/processLog';
import { scoreEvaluationRun, type EvaluationRunScore } from '../../services/evaluationObservability';
import type { RunCheckpoint } from '../../services/runCheckpoints';
import { loadRoutingDecisionRecords } from '../../services/routingObservability';

/**
 * Derives ProcessEntry rows from legacy ChatMessage fields so the unified
 * graph still renders for older stored messages that predate ProcessLog.
 */
function deriveLegacyEntries(message: ChatMessage): ProcessEntry[] {
  const entries: ProcessEntry[] = [];
  let position = 0;
  (message.reasoningSteps ?? []).forEach((step) => {
    const kind: ProcessEntryKind = step.kind === 'tool' ? 'tool-call' : 'reasoning';
    entries.push({
      id: `legacy-reasoning:${step.id}`,
      position: position++,
      ts: step.startedAt || 0,
      kind,
      actor: step.toolName ?? step.kind,
      summary: step.title,
      transcript: step.transcript ?? step.body,
      payload: step.toolArgs ?? step.toolResult ?? step.body,
      branchId: step.parentStepId ? step.parentStepId : 'reasoning',
      status: step.status,
      ...(step.endedAt !== undefined ? { endedAt: step.endedAt } : {}),
    });
  });
  (message.voterSteps ?? []).forEach((step) => {
    entries.push({
      id: `legacy-voter:${step.id}`,
      position: position++,
      ts: step.startedAt || 0,
      kind: 'vote',
      actor: `voter:${step.voterId}`,
      summary:
        step.approve === true ? `${step.voterId} ✓`
        : step.approve === false ? `${step.voterId} ✗`
        : `${step.voterId} reviewing`,
      transcript: step.thought ?? step.body,
      payload: step,
      branchId: 'voters',
      status: step.status,
      ...(step.endedAt !== undefined ? { endedAt: step.endedAt } : {}),
    });
  });
  (message.busEntries ?? []).forEach((entry) => {
    const kindMap: Record<string, ProcessEntryKind> = {
      Mail: 'mail', InfIn: 'inf-in', InfOut: 'inf-out',
      Intent: 'intent', Vote: 'vote', Commit: 'commit',
      Abort: 'abort', Result: 'result', Completion: 'completion',
      Policy: 'policy',
    };
    entries.push({
      id: `legacy-bus:${entry.id}`,
      position: position++,
      ts: entry.realtimeTs,
      kind: kindMap[entry.payloadType] ?? 'reasoning',
      actor: entry.actor ? entry.actor : 'bus',
      summary: entry.summary,
      transcript: entry.detail,
      payload: entry,
      branchId: 'bus',
      status: 'done',
    });
  });
  return entries;
}

function formatScore(score: number): string {
  return `${score}%`;
}

function formatVerdict(verdict: EvaluationRunScore['verdict']): string {
  switch (verdict) {
    case 'needs-review':
      return 'Needs review';
    case 'passing':
      return 'Passing';
    case 'warning':
      return 'Warning';
    case 'failing':
      return 'Failing';
  }
}

function EvaluationScoreStrip({ score }: { score: EvaluationRunScore }) {
  return (
    <section
      className={`evaluation-score-strip evaluation-score-strip--${score.verdict}`}
      aria-label="Evaluation-native observability"
    >
      <header className="evaluation-score-header">
        <div className="evaluation-score-title">
          <span>Evaluation</span>
          <strong>{formatScore(score.overallScore)}</strong>
        </div>
        <span className="evaluation-score-verdict">{formatVerdict(score.verdict)}</span>
      </header>
      <div className="evaluation-score-grid">
        {score.scorers.map((scorer) => (
          <div key={scorer.id} className={`evaluation-scorer evaluation-scorer--${scorer.status}`}>
            <div className="evaluation-scorer-row">
              <strong>{scorer.label}</strong>
              <span>{formatScore(scorer.score)}</span>
            </div>
            <p>{scorer.summary}</p>
            <small>{scorer.evidenceEntryIds.length} linked trace row{scorer.evidenceEntryIds.length === 1 ? '' : 's'}</small>
          </div>
        ))}
      </div>
      <footer className="evaluation-score-meta">
        <span>
          Dataset case <code>{score.datasetCase.caseId}</code>
        </span>
        <span>
          Live experiment <code>{score.experiment.experimentId}</code>
        </span>
      </footer>
    </section>
  );
}

function isCheckpointPayload(value: unknown): value is { checkpoint: RunCheckpoint } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const checkpoint = (value as { checkpoint?: unknown }).checkpoint;
  if (typeof checkpoint !== 'object' || checkpoint === null || Array.isArray(checkpoint)) return false;
  const candidate = checkpoint as Partial<RunCheckpoint>;
  return (
    typeof candidate.id === 'string'
    && typeof candidate.summary === 'string'
    && typeof candidate.reason === 'string'
    && typeof candidate.status === 'string'
    && typeof candidate.requiredInput === 'string'
    && typeof candidate.resumeToken === 'string'
  );
}

function CheckpointStrip({ checkpoints }: { checkpoints: RunCheckpoint[] }) {
  if (!checkpoints.length) return null;
  return (
    <section className="checkpoint-process-strip" aria-label="Suspended checkpoint">
      <header>
        <span>Suspended checkpoint</span>
        <strong>{checkpoints.length} resumable</strong>
      </header>
      <div className="checkpoint-process-grid">
        {checkpoints.map((checkpoint) => (
          <article key={checkpoint.id} className="checkpoint-process-card">
            <div className="checkpoint-process-row">
              <strong>{checkpoint.summary}</strong>
              <span className="badge connected">{checkpoint.reason}</span>
            </div>
            <p>{checkpoint.requiredInput}</p>
            <code>{checkpoint.resumeToken}</code>
          </article>
        ))}
      </div>
    </section>
  );
}


function RoutingDiagnosticsStrip() {
  const latest = useMemo(() => {
    const records = loadRoutingDecisionRecords();
    return records.at(-1);
  }, []);
  if (!latest) return null;
  return (
    <section className="checkpoint-process-strip" aria-label="Routing diagnostics">
      <header>
        <span>Routing diagnostics</span>
        <strong>{latest.selectedProvider}/{latest.selectedModel}</strong>
      </header>
      <div className="checkpoint-process-grid">
        <article className="checkpoint-process-card">
          <div className="checkpoint-process-row">
            <strong>Task class</strong>
            <span className="badge connected">{latest.taskClass}</span>
          </div>
          <p>Complexity {latest.complexityTier} ({latest.complexityScore}) @ {latest.complexityConfidence}</p>
          <p>Evidence: {latest.benchmarkEvidenceSource}</p>
          <p>Safeguards: {latest.safeguardsTriggered.length ? latest.safeguardsTriggered.join(', ') : 'none'}</p>
          <code>Δ cost {latest.estimatedCostDelta} · Δ latency {latest.estimatedLatencyDelta}</code>
        </article>
      </div>
    </section>
  );
}

/**
 * Full-pane overlay rendering the unified ProcessLog graph + drill-down.
 */
export function ProcessPanel({
  message,
  onClose,
}: {
  message: ChatMessage;
  onClose: () => void;
}) {
  const entries = useMemo<ProcessEntry[]>(() => {
    if (message.processEntries?.length) return message.processEntries;
    return deriveLegacyEntries(message);
  }, [message]);
  const evaluationScore = useMemo(
    () => scoreEvaluationRun({ message, entries }),
    [entries, message],
  );
  const checkpointEntries = useMemo(
    () => entries
      .map((entry) => entry.payload)
      .filter(isCheckpointPayload)
      .map((payload) => payload.checkpoint)
      .filter((checkpoint) => checkpoint.status === 'suspended'),
    [entries],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId
    ? entries.find((entry) => entry.id === selectedId)
    : undefined;

  const duration = (() => {
    if (!entries.length) return undefined;
    const earliest = Math.min(...entries.map((e) => e.ts));
    const latest = Math.max(...entries.map((e) => e.endedAt ?? e.ts));
    return Math.max(1, Math.round((latest - earliest) / 1000));
  })();
  const isActive = entries.some((e) => e.status === 'active') || message.isThinking === true;
  const headerSubtitle = entries.length
    ? `${entries.length} event${entries.length === 1 ? '' : 's'}${duration ? ` · ${formatOperationDuration(duration)}` : ''}`
    : 'No events';
  return (
    <>
      <aside className="op-pane pg-panel" aria-label="Process graph">
        <header className="op-pane-header">
          <button
            type="button"
            className="op-pane-back"
            aria-label="Back to chat"
            onClick={onClose}
          >
            <ArrowLeft size={14} />
          </button>
          <div className="op-pane-title">
            <strong>Process</strong>
            <span className="pg-panel-subtitle">{headerSubtitle}</span>
          </div>
        </header>
        <div className="pg-panel-body">
          <EvaluationScoreStrip score={evaluationScore} />
          <CheckpointStrip checkpoints={checkpointEntries} />
          <RoutingDiagnosticsStrip />
          <ProcessGraph
            entries={entries}
            selectedEntryId={selectedId ?? undefined}
            onSelectEntry={setSelectedId}
          />
        </div>
        {!isActive && duration ? (
          <footer className="op-pane-footer">
            <span>Process took {formatOperationDuration(duration)}</span>
            <span>Done</span>
          </footer>
        ) : null}
      </aside>
      {selected ? (
        <ProcessDrilldown entry={selected} onBack={() => setSelectedId(null)} />
      ) : null}
    </>
  );
}
