export type AgentProvider = 'codi' | 'ghcp';

import type { ReasoningStep, VoterStep } from '../types';

export interface AgentStreamCallbacks {
  onPhase?: (phase: string) => void;
  onReasoning?: (delta: string) => void;
  onReasoningStep?: (step: ReasoningStep) => void;
  onReasoningStepUpdate?: (id: string, patch: Partial<ReasoningStep>) => void;
  onReasoningStepEnd?: (id: string) => void;
  onToken?: (delta: string) => void;
  onDone?: (finalContent?: string) => void;
  onError?: (error: Error) => void;
  /** Fired when a voter begins evaluating an intent. */
  onVoterStep?: (step: VoterStep) => void;
  /** Fired to patch a voter step (e.g. once the vote result is known). */
  onVoterStepUpdate?: (id: string, patch: Partial<VoterStep>) => void;
  /** Fired when a voter's evaluation is complete. */
  onVoterStepEnd?: (id: string) => void;
}