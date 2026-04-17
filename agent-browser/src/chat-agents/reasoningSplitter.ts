import { createUniqueId } from '../utils/uniqueId';
import type { ReasoningStep, ReasoningStepKind } from '../types';

type SplitterOptions = {
  markers?: boolean;
  now?: () => number;
  createId?: () => string;
  onStepStart?: (step: ReasoningStep) => void;
  onStepUpdate?: (id: string, patch: Partial<ReasoningStep>) => void;
  onStepEnd?: (id: string) => void;
};

const markerPattern = /^###(STEP|SEARCH):\s*(.+)$/i;

function normalizeBody(body: string): string {
  return body.replace(/\r/g, '').replace(/^\n+|\n+$/g, '');
}

function deriveTitle(body: string): string {
  const normalized = normalizeBody(body).replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Thinking';
  const sentence = normalized.match(/.+?[.!?](?:\s|$)/)?.[0]?.trim() ?? normalized;
  return sentence.length > 60 ? `${sentence.slice(0, 57).trimEnd()}...` : sentence;
}

export class ReasoningStepSplitter {
  private readonly markers: boolean;

  private readonly now: () => number;

  private readonly createId: () => string;

  private readonly onStepStart?: (step: ReasoningStep) => void;

  private readonly onStepUpdate?: (id: string, patch: Partial<ReasoningStep>) => void;

  private readonly onStepEnd?: (id: string) => void;

  private pendingText = '';

  private activeStepId: string | null = null;

  private explicitTitle: string | null = null;

  private committedLines: string[] = [];

  private publishedTitle = 'Thinking';

  private publishedBody = '';

  constructor(options: SplitterOptions = {}) {
    this.markers = options.markers ?? false;
    this.now = options.now ?? Date.now;
    this.createId = options.createId ?? createUniqueId;
    this.onStepStart = options.onStepStart;
    this.onStepUpdate = options.onStepUpdate;
    this.onStepEnd = options.onStepEnd;
  }

  push(delta: string): void {
    if (!delta) return;
    this.pendingText += delta;
    this.processCompleteLines();
    this.publishDraft();
  }

  finish(): void {
    if (this.pendingText) {
      this.ensureActiveStep();
      this.publishDraft();
    }
    this.finalizeActiveStep(true);
  }

  private processCompleteLines(): void {
    let newlineIndex = this.pendingText.indexOf('\n');
    while (newlineIndex !== -1) {
      const rawLine = this.pendingText.slice(0, newlineIndex).replace(/\r$/, '');
      this.pendingText = this.pendingText.slice(newlineIndex + 1);

      if (this.tryStartMarkerStep(rawLine)) {
        newlineIndex = this.pendingText.indexOf('\n');
        continue;
      }

      if (!rawLine.trim()) {
        this.finalizeActiveStep(false);
        newlineIndex = this.pendingText.indexOf('\n');
        continue;
      }

      this.ensureActiveStep();
      this.committedLines.push(rawLine);
      this.publishDraft();
      newlineIndex = this.pendingText.indexOf('\n');
    }
  }

  private tryStartMarkerStep(line: string): boolean {
    if (!this.markers) return false;
    const match = line.trim().match(markerPattern);
    if (!match) return false;
    this.finalizeActiveStep(false);
    this.ensureActiveStep(match[1].toUpperCase() === 'SEARCH' ? 'search' : 'thinking', match[2].trim() || 'Thinking');
    this.publishDraft();
    return true;
  }

  private ensureActiveStep(kind: ReasoningStepKind = 'thinking', title?: string): void {
    if (this.activeStepId) return;
    const step: ReasoningStep = {
      id: this.createId(),
      kind,
      title: title || 'Thinking',
      startedAt: this.now(),
      status: 'active',
    };
    this.activeStepId = step.id;
    this.explicitTitle = title ?? null;
    this.committedLines = [];
    this.publishedTitle = step.title;
    this.publishedBody = '';
    this.onStepStart?.(step);
  }

  private publishDraft(): void {
    if (!this.activeStepId) {
      if (this.pendingText.trim()) {
        this.ensureActiveStep();
      } else {
        return;
      }
    }

    if (!this.activeStepId) return;
    const body = normalizeBody([...this.committedLines, this.pendingText].join('\n'));
    const title = this.explicitTitle ?? deriveTitle(body);
    if (body === this.publishedBody && title === this.publishedTitle) return;
    this.publishedBody = body;
    this.publishedTitle = title;
    this.onStepUpdate?.(this.activeStepId, {
      title,
      body: body || undefined,
      status: 'active',
    });
  }

  private finalizeActiveStep(includePendingText: boolean): void {
    if (!this.activeStepId) return;
    const body = normalizeBody([...this.committedLines, includePendingText ? this.pendingText : ''].join('\n'));
    const title = this.explicitTitle ?? deriveTitle(body);
    this.onStepUpdate?.(this.activeStepId, {
      title,
      body: body || undefined,
      endedAt: this.now(),
      status: 'done',
    });
    this.onStepEnd?.(this.activeStepId);
    this.activeStepId = null;
    this.explicitTitle = null;
    this.committedLines = [];
    this.publishedTitle = 'Thinking';
    this.publishedBody = '';
    if (includePendingText) this.pendingText = '';
  }
}

export function createReasoningStepSplitter(options: SplitterOptions = {}): ReasoningStepSplitter {
  return new ReasoningStepSplitter(options);
}