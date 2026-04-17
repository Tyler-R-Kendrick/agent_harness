import { LoaderCircle, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import type { ChatMessage, ReasoningStep } from '../../types';
import {
  OperationPane,
  OperationTrigger,
  formatOperationDuration,
} from '../operation-pane';

function deriveLegacySteps(message: ChatMessage): ReasoningStep[] {
  const content = message.thinkingContent?.trim();
  if (!content) return [];
  return content
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((body, index) => ({
      id: `${message.id}:legacy:${index}`,
      kind: 'thinking',
      title: body.split(/[.!?]\s/)[0]?.trim().slice(0, 60) || 'Thinking',
      body,
      startedAt: message.reasoningStartedAt ?? 0,
      status: index === Math.max(0, content.split(/\n{2,}/).length - 1) && message.isThinking ? 'active' : 'done',
    }));
}

export function getRenderableReasoningSteps(message: ChatMessage): ReasoningStep[] {
  return message.reasoningSteps?.length ? message.reasoningSteps : deriveLegacySteps(message);
}

/** @deprecated Use formatOperationDuration from operation-pane instead. */
export function formatReasoningDuration(totalSeconds?: number): string {
  return formatOperationDuration(totalSeconds);
}

// (All timeline / source / live-duration rendering is now in OperationPane.)

export function InlineReasoning({
  message,
  onOpenActivity,
}: {
  message: ChatMessage;
  selected?: boolean;
  onOpenActivity?: (messageId: string) => void;
}) {
  const steps = useMemo(() => getRenderableReasoningSteps(message), [message]);
  const isThinking = Boolean(
    steps.some((s) => s.status === 'active') || message.isThinking,
  );
  const duration = message.thinkingDuration;

  if (!steps.length && !message.isThinking && !duration) return null;

  return (
    <OperationTrigger
      isActive={isThinking}
      durationSeconds={duration}
      activeLabel="Thinking…"
      doneLabelPrefix="Thought for"
      activeIcon={<LoaderCircle size={13} className="spin" style={{ color: '#a78bfa', flexShrink: 0 }} />}
      doneIcon={<Sparkles size={13} />}
      activeClassName="reasoning-pill-thinking"
      onOpen={() => onOpenActivity?.(message.id)}
    />
  );
}

export function ActivityPanel({
  message,
  onClose,
}: {
  message: ChatMessage;
  pinned?: boolean;
  onTogglePin?: () => void;
  onClose: () => void;
}) {
  const steps = useMemo(() => getRenderableReasoningSteps(message), [message]);

  return (
    <OperationPane
      steps={steps}
      title="Thoughts"
      ariaLabel="Activity panel"
      backLabel="Back to chat"
      isActive={message.isThinking}
      startedAt={message.reasoningStartedAt}
      durationSeconds={message.thinkingDuration}
      footer={
        !message.isThinking && message.thinkingDuration ? (
          <footer className="op-pane-footer">
            <span>Thought for {formatOperationDuration(message.thinkingDuration)}</span>
            <span>Done</span>
          </footer>
        ) : null
      }
      onClose={onClose}
    />
  );
}