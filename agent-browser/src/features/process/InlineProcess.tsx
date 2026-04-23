import { Activity, LoaderCircle } from 'lucide-react';
import { useMemo } from 'react';
import type { ChatMessage } from '../../types';
import { OperationTrigger, formatOperationDuration } from '../operation-pane';

/**
 * Single inline pill that surfaces the unified ProcessLog for a turn.
 *
 * It still reads legacy `reasoningSteps`, `voterSteps`, and `busEntries`
 * so older stored messages continue to surface a pill.
 */
export function InlineProcess({
  message,
  selected,
  onOpenActivity,
}: {
  message: ChatMessage;
  selected?: boolean;
  onOpenActivity?: (messageId: string) => void;
}) {
  void selected;
  const processEntries = message.processEntries ?? [];
  const reasoningSteps = message.reasoningSteps ?? [];
  const voterSteps = message.voterSteps ?? [];
  const busEntries = message.busEntries ?? [];

  const isStreaming = message.status === 'streaming' || message.isThinking;
  const hasActiveProcessEntry = processEntries.some((entry) => entry.status === 'active');
  const hasActiveReasoning = reasoningSteps.some((step) => step.status === 'active');
  const hasActiveVoter = voterSteps.some((step) => step.status === 'active');
  const isActive = isStreaming || hasActiveProcessEntry || hasActiveReasoning || hasActiveVoter;

  const duration = useMemo(() => {
    if (processEntries.length) {
      const earliest = Math.min(...processEntries.map((entry) => entry.ts));
      const latest = Math.max(...processEntries.map((entry) => entry.endedAt ?? entry.ts));
      return Math.max(1, Math.round((latest - earliest) / 1000));
    }
    if (message.thinkingDuration) return message.thinkingDuration;
    if (busEntries.length) {
      const earliest = Math.min(...busEntries.map((entry) => entry.realtimeTs));
      const latest = Math.max(...busEntries.map((entry) => entry.realtimeTs));
      return Math.max(1, Math.round((latest - earliest) / 1000));
    }
    return undefined;
  }, [processEntries, busEntries, message.thinkingDuration]);

  const count = processEntries.length
    || reasoningSteps.length + voterSteps.length + busEntries.length;

  const hasAnythingToShow = count > 0
    || message.thinkingContent
    || message.thinkingDuration
    || message.isThinking;

  if (!hasAnythingToShow && !isActive && !duration) return null;

  const activeStepTitle = useMemo(() => {
    const lastActiveProcess = [...processEntries].reverse().find((entry) => entry.status === 'active');
    if (lastActiveProcess) return lastActiveProcess.summary;
    const lastActiveReasoning = [...reasoningSteps].reverse().find((step) => step.status === 'active');
    if (lastActiveReasoning) return lastActiveReasoning.title;
    return undefined;
  }, [processEntries, reasoningSteps]);

  const activeLabel = activeStepTitle
    ?? (count
      ? `Working… · ${count} event${count === 1 ? '' : 's'}`
      : 'Working…');
  const doneLabelPrefix = count
    ? `Process · ${count} event${count === 1 ? '' : 's'} ·`
    : 'Process ·';

  return (
    <OperationTrigger
      isActive={isActive}
      durationSeconds={duration}
      activeLabel={activeLabel}
      doneLabelPrefix={doneLabelPrefix}
      activeIcon={
        <LoaderCircle
          size={13}
          className="spin"
          style={{ color: '#a78bfa', flexShrink: 0 }}
        />
      }
      doneIcon={<Activity size={13} />}
      activeClassName="process-pill-active"
      onOpen={() => onOpenActivity?.(message.id)}
    />
  );
}

/** Helper exported for tests: format a process-log duration. */
export function formatProcessDuration(seconds?: number): string {
  return formatOperationDuration(seconds);
}
