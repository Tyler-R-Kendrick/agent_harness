import { LoaderCircle, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import type { ChatMessage, VoterStep } from '../../types';
import {
  OperationPane,
  OperationTrigger,
  formatOperationDuration,
} from '../operation-pane';

// ─── Voter step → OperationStep mapping ───────────────────────────────────

/**
 * Converts VoterStep[] to the OperationStep interface accepted by
 * OperationPane / OperationTimeline.  VoterStep is structurally compatible
 * (kind: 'agent', title = voterId display name, body = vote outcome) so the
 * cast is safe without any data transformation.
 */
function toOperationSteps(steps: VoterStep[]) {
  return steps as import('../operation-pane').OperationStep[];
}

// ─── InlineVoters — inherits OperationTrigger rendering ───────────────────

/**
 * Inline pill that surfaces voter activity in the chat transcript.
 * Renders like InlineReasoning / OperationTrigger: active spinner while
 * voters are evaluating, shield-check chip once all votes are in.
 */
export function InlineVoters({
  message,
  onOpenActivity,
}: {
  message: ChatMessage;
  onOpenActivity?: (messageId: string) => void;
}) {
  const steps = message.voterSteps ?? [];
  const isVoting = Boolean(
    message.isVoting || steps.some((s) => s.status === 'active'),
  );

  const durationSeconds = useMemo(() => {
    if (!steps.length) return undefined;
    const allDone = steps.every((s) => s.status === 'done');
    if (!allDone) return undefined;
    const earliest = Math.min(...steps.map((s) => s.startedAt));
    const latest = Math.max(...steps.map((s) => s.endedAt ?? s.startedAt));
    return Math.max(1, Math.round((latest - earliest) / 1000));
  }, [steps]);

  if (!steps.length && !message.isVoting) return null;

  return (
    <OperationTrigger
      isActive={isVoting}
      durationSeconds={durationSeconds}
      activeLabel="Agents reviewing…"
      doneLabelPrefix="Agents reviewed in"
      activeIcon={<LoaderCircle size={13} className="spin" style={{ color: '#60a5fa', flexShrink: 0 }} />}
      doneIcon={<ShieldCheck size={13} />}
      activeClassName="voters-pill-reviewing"
      onOpen={() => onOpenActivity?.(message.id)}
    />
  );
}

// ─── VotersPanel — inherits OperationPane rendering ───────────────────────

/**
 * Full-pane overlay showing each voter's evaluation as a timeline step.
 * Directly reuses OperationPane + OperationTimeline — voters are external
 * agents rendered the same way reasoning steps are rendered.
 */
export function VotersPanel({
  message,
  onClose,
}: {
  message: ChatMessage;
  onClose: () => void;
}) {
  const steps = useMemo(() => toOperationSteps(message.voterSteps ?? []), [message.voterSteps]);
  const isVoting = Boolean(
    message.isVoting || (message.voterSteps ?? []).some((s) => s.status === 'active'),
  );

  const durationSeconds = useMemo(() => {
    if (!steps.length) return undefined;
    const allDone = steps.every((s) => s.status === 'done');
    if (!allDone) return undefined;
    const earliest = Math.min(...steps.map((s) => s.startedAt));
    const latest = Math.max(...steps.map((s) => s.endedAt ?? s.startedAt));
    return Math.max(1, Math.round((latest - earliest) / 1000));
  }, [steps]);

  return (
    <OperationPane
      steps={steps}
      title="Agent Reviewers"
      ariaLabel="Agent reviewers panel"
      backLabel="Back to chat"
      isActive={isVoting}
      durationSeconds={durationSeconds}
      footer={
        !isVoting && durationSeconds ? (
          <footer className="op-pane-footer">
            <span>Reviewed in {formatOperationDuration(durationSeconds)}</span>
            <span>Done</span>
          </footer>
        ) : null
      }
      onClose={onClose}
    />
  );
}
