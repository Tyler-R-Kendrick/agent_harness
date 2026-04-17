export type AgentProvider = 'codi' | 'ghcp';

import type { ReasoningStep } from '../types';

export interface AgentStreamCallbacks {
  onPhase?: (phase: string) => void;
  onReasoning?: (delta: string) => void;
  onReasoningStep?: (step: ReasoningStep) => void;
  onReasoningStepUpdate?: (id: string, patch: Partial<ReasoningStep>) => void;
  onReasoningStepEnd?: (id: string) => void;
  onToken?: (delta: string) => void;
  onDone?: (finalContent?: string) => void;
  onError?: (error: Error) => void;
}