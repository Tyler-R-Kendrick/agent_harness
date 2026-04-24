export type ModelBackedAgentProvider = 'codi' | 'ghcp';
export type AgentProvider = ModelBackedAgentProvider | 'researcher';

import type { IterationStep, ReasoningStep, VoterStep } from '../types';

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
  /** Fired when a Ralph-loop iteration begins. */
  onIterationStep?: (step: IterationStep) => void;
  /** Fired to patch an iteration step once the completion check resolves. */
  onIterationStepUpdate?: (id: string, patch: Partial<IterationStep>) => void;
  /** Fired when a Ralph-loop iteration is complete. */
  onIterationStepEnd?: (id: string) => void;
}
