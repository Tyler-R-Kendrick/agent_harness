import type {
  CompletionScore,
  IAgentBus,
  ICompletionChecker,
  IExecutor,
  IInferenceClient,
  IVoter,
  QuorumPolicy,
} from 'logact';

export type CoreStepStatus = 'active' | 'done';

export interface CoreVoterStep {
  id: string;
  kind: 'agent';
  title: string;
  voterId: string;
  body?: string;
  approve?: boolean;
  thought?: string;
  startedAt: number;
  endedAt?: number;
  status: CoreStepStatus;
}

export interface CoreIterationStep {
  id: string;
  kind: 'iteration';
  title: string;
  body?: string;
  score?: CompletionScore;
  done?: boolean;
  startedAt: number;
  endedAt?: number;
  status: CoreStepStatus;
}

export interface CoreAgentLoopCallbacks {
  onVoterStep?: (step: CoreVoterStep) => void;
  onVoterStepUpdate?: (id: string, patch: Partial<CoreVoterStep>) => void;
  onVoterStepEnd?: (id: string) => void;
  onIterationStep?: (step: CoreIterationStep) => void;
  onIterationStepUpdate?: (id: string, patch: Partial<CoreIterationStep>) => void;
  onIterationStepEnd?: (id: string) => void;
}

export interface LogActAgentLoopOptions {
  inferenceClient: IInferenceClient;
  messages: Array<{ content: string }>;
  voters?: IVoter[];
  input?: string;
  bus?: IAgentBus;
  maxTurns?: number;
  maxIterations?: number;
  quorumPolicy?: QuorumPolicy;
  completionChecker?: ICompletionChecker;
  executor?: IExecutor;
}
