export type AgentProvider = 'codi' | 'ghcp';

export interface AgentStreamCallbacks {
  onPhase?: (phase: string) => void;
  onReasoning?: (delta: string) => void;
  onToken?: (delta: string) => void;
  onDone?: (finalContent?: string) => void;
  onError?: (error: Error) => void;
}